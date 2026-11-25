import express, { Router } from "express";
import multer from "multer";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import { validate, httpError } from "./http-errors.js";
import {
  positiveId,
  productInclude,
  specName,
  specValue,
  useCases,
} from "./catalog.js";

const text = (max) => z.string().trim().min(1).max(max);
const imageUrl = text(2000).refine((value) => {
  if (/^\/(?:images|api\/uploads)\/[a-zA-Z0-9_./-]+$/.test(value))
    return !value.includes("..");
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Use an HTTPS image URL, /images/filename, or an uploaded image path.");
const specifications = z
  .array(
    z
      .object({
        name: text(60).transform(specName),
        value: text(120).transform(specValue),
      })
      .strict(),
  )
  .max(40)
  .refine(
    (items) =>
      new Set(items.map((item) => item.name.toLowerCase())).size ===
      items.length,
    "Specification names must be unique.",
  );
const productFields = {
  sku: text(60),
  name: text(150),
  description: text(4000),
  price: z
    .union([
      z.string().regex(/^\d{1,14}$/),
      z.number().int().min(0).max(99999999999999),
    ])
    .transform(String),
  stock: z.number().int().min(0).max(2147483647),
  active: z.boolean(),
  warrantyText: text(1000),
  categoryId: positiveId,
  brandId: positiveId,
  useCases: z
    .array(z.enum(useCases))
    .max(4)
    .transform((values) => [...new Set(values)]),
  specs: specifications,
  images: z.array(z.object({ url: imageUrl, alt: text(200) }).strict()).max(8),
};
const creation = z.object(productFields).strict();
const update = z
  .object(productFields)
  .partial()
  .extend({ version: z.number().int().min(0) })
  .strict();

function detectedImage(buffer) {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return ["image/png", "png"];
  if (
    buffer.length >= 3 &&
    buffer[0] === 255 &&
    buffer[1] === 216 &&
    buffer[2] === 255
  )
    return ["image/jpeg", "jpg"];
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return ["image/webp", "webp"];
  return null;
}

export function registerUploadDelivery(app, uploadDir) {
  app.use(
    "/api/uploads",
    express.static(uploadDir, {
      dotfiles: "deny",
      index: false,
      fallthrough: false,
      maxAge: "1d",
      setHeaders: (res) => res.set("X-Content-Type-Options", "nosniff"),
    }),
  );
}

export function registerAdminCatalog(app, { prisma, requireUser, uploadDir }) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 },
  });
  router.post("/uploads", upload.single("image"), async (req, res) => {
    const detected = req.file && detectedImage(req.file.buffer);
    if (!detected || detected[0] !== req.file.mimetype)
      throw httpError(
        422,
        "Choose a PNG, JPEG, or WebP image of at most 2 MB.",
      );
    await mkdir(uploadDir, { recursive: true });
    const filename = `${randomUUID()}.${detected[1]}`;
    await writeFile(join(uploadDir, filename), req.file.buffer, { flag: "wx" });
    res.status(201).json({ url: `/api/uploads/${filename}` });
  });
  for (const [path, model] of [
    ["categories", "category"],
    ["brands", "brand"],
  ]) {
    router.post(`/${path}`, async (req, res) => {
      const input = validate(z.object({ name: text(80) }).strict(), req.body);
      res
        .status(201)
        .json({ record: await prisma[model].create({ data: input }) });
    });
    router.patch(`/${path}/:id`, async (req, res) => {
      const id = validate(positiveId, req.params.id),
        input = validate(z.object({ name: text(80) }).strict(), req.body);
      res.json({
        record: await prisma[model].update({ where: { id }, data: input }),
      });
    });
    router.delete(`/${path}/:id`, async (req, res) => {
      const id = validate(positiveId, req.params.id);
      const deleted = await prisma[model].deleteMany({ where: { id } });
      if (!deleted.count) throw httpError(404, "Record not found.");
      res.json({ message: "Record deleted." });
    });
  }
  router.get("/products", async (req, res) => {
    const query = validate(
      z
        .object({
          q: z.string().trim().max(120).optional(),
          page: z.coerce.number().int().min(1).max(10000).default(1),
          active: z.enum(["all", "true", "false"]).default("all"),
        })
        .strict(),
      req.query,
    );
    const where = {
      ...(query.active !== "all" ? { active: query.active === "true" } : {}),
      ...(query.q
        ? {
            OR: ["name", "sku"].map((field) => ({
              [field]: { contains: query.q, mode: "insensitive" },
            })),
          }
        : {}),
    };
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { id: "desc" },
        skip: (query.page - 1) * 20,
        take: 20,
      }),
      prisma.product.count({ where }),
    ]);
    res.json({ products, total, page: query.page, pageSize: 20 });
  });
  router.get("/products/:id", async (req, res) => {
    const id = validate(positiveId, req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) throw httpError(404, "Product not found.");
    res.json({ product });
  });
  async function references(tx, input) {
    if (
      input.categoryId !== undefined &&
      !(await tx.category.findUnique({ where: { id: input.categoryId } }))
    )
      throw httpError(422, "Choose an existing category.", {
        categoryId: ["Category not found."],
      });
    if (
      input.brandId !== undefined &&
      !(await tx.brand.findUnique({ where: { id: input.brandId } }))
    )
      throw httpError(422, "Choose an existing brand.", {
        brandId: ["Brand not found."],
      });
  }
  router.post("/products", async (req, res) => {
    const { specs, images, ...input } = validate(creation, req.body);
    const product = await prisma.$transaction(async (tx) => {
      await references(tx, input);
      return tx.product.create({
        data: {
          ...input,
          specs: { create: specs },
          images: {
            create: images.map((image, sortOrder) => ({ ...image, sortOrder })),
          },
        },
        include: productInclude,
      });
    });
    res.status(201).json({ product });
  });
  router.patch("/products/:id", async (req, res) => {
    const id = validate(positiveId, req.params.id);
    const { version, specs, images, ...input } = validate(update, req.body);
    const product = await prisma.$transaction(async (tx) => {
      await references(tx, input);
      const changed = await tx.product.updateMany({
        where: { id, version },
        data: { ...input, version: { increment: 1 } },
      });
      if (!changed.count) {
        if (!(await tx.product.findUnique({ where: { id } })))
          throw httpError(404, "Product not found.");
        throw httpError(
          409,
          "This product or its stock changed since you opened it. Reload the editor before saving.",
        );
      }
      if (specs !== undefined) {
        await tx.productSpec.deleteMany({ where: { productId: id } });
        if (specs.length)
          await tx.productSpec.createMany({
            data: specs.map((spec) => ({ ...spec, productId: id })),
          });
      }
      if (images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (images.length)
          await tx.productImage.createMany({
            data: images.map((image, sortOrder) => ({
              ...image,
              sortOrder,
              productId: id,
            })),
          });
      }
      return tx.product.findUnique({ where: { id }, include: productInclude });
    });
    res.json({ product });
  });
  router.delete("/products/:id", async (req, res) => {
    const id = validate(positiveId, req.params.id),
      { version } = validate(
        z.object({ version: z.number().int().min(0) }).strict(),
        req.body,
      );
    const changed = await prisma.product.updateMany({
      where: { id, version },
      data: { active: false, version: { increment: 1 } },
    });
    if (!changed.count)
      throw httpError(
        409,
        "The product changed or no longer exists. Reload the list.",
      );
    res.json({
      message:
        "Product hidden. Existing cart and order records were preserved.",
    });
  });
  app.use(
    "/api/admin",
    requireUser,
    (req, res, next) => {
      if (req.user.role !== "ADMIN")
        return res
          .status(403)
          .json({ message: "Administrator access is required." });
      next();
    },
    router,
  );
}
