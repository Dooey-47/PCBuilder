import { z } from "zod";
import { validate, httpError } from "./http-errors.js";

export const productInclude = {
  category: true,
  brand: true,
  specs: { orderBy: { id: "asc" } },
  images: { orderBy: { sortOrder: "asc" } },
};
export const useCases = ["study", "office", "gaming", "creative"];
export const positiveId = z.coerce.number().int().positive().max(2147483647);
const amount = z.coerce.number().int().min(0).max(99999999999999);
const aliases = {
  ram: "Memory",
  memory: "Memory",
  cpu: "Processor",
  processor: "Processor",
  ssd: "Storage",
  storage: "Storage",
  display: "Display",
  graphics: "Graphics",
  resolution: "Resolution",
  "refresh rate": "Refresh rate",
  weight: "Weight",
};
export function specName(value) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  return aliases[cleaned.toLowerCase()] ?? cleaned;
}
export function specValue(value) {
  const units = {
    gb: "GB",
    tb: "TB",
    mhz: "MHz",
    ghz: "GHz",
    hz: "Hz",
    w: "W",
    kg: "kg",
  };
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(
      /(\d+(?:\.\d+)?)\s*(gb|tb|mhz|ghz|hz|w|kg)\b/gi,
      (_, number, unit) => `${number} ${units[unit.toLowerCase()]}`,
    );
}
const specQuery = z
  .string()
  .max(4000)
  .optional()
  .transform((value, ctx) => {
    if (!value) return {};
    try {
      const parsed = z
        .record(
          z.string().trim().min(1).max(60),
          z.string().trim().min(1).max(120),
        )
        .parse(JSON.parse(value));
      if (Object.keys(parsed).length > 8) throw new Error();
      return Object.fromEntries(
        Object.entries(parsed).map(([name, entry]) => [
          specName(name),
          specValue(entry),
        ]),
      );
    } catch {
      ctx.addIssue({
        code: "custom",
        message:
          "Specifications must be a JSON object with up to 8 name/value pairs.",
      });
      return z.NEVER;
    }
  });
const productQuery = z
  .object({
    q: z.string().trim().max(120).optional(),
    category: positiveId.optional(),
    brand: positiveId.optional(),
    min_price: amount.optional(),
    max_price: amount.optional(),
    sort: z
      .enum(["featured", "price_asc", "price_desc", "name", "newest"])
      .default("featured"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    in_stock: z.enum(["true", "false"]).optional(),
    use_case: z.enum(useCases).optional(),
    spec: specQuery,
  })
  .strict()
  .refine(
    (query) =>
      query.min_price === undefined ||
      query.max_price === undefined ||
      query.min_price <= query.max_price,
    {
      path: ["max_price"],
      message: "Maximum price must not be below minimum price.",
    },
  );

export function registerCatalog(app, prisma) {
  app.get("/api/categories", async (_req, res) =>
    res.json({
      categories: await prisma.category.findMany({ orderBy: { name: "asc" } }),
    }),
  );
  app.get("/api/brands", async (_req, res) =>
    res.json({
      brands: await prisma.brand.findMany({ orderBy: { name: "asc" } }),
    }),
  );
  app.get("/api/catalog-filters", async (req, res) => {
    const query = validate(
      z.object({ category: positiveId.optional() }).strict(),
      req.query,
    );
    const values = await prisma.productSpec.findMany({
      where: {
        product: {
          active: true,
          ...(query.category ? { categoryId: query.category } : {}),
        },
      },
      select: { name: true, value: true },
      distinct: ["name", "value"],
      orderBy: [{ name: "asc" }, { value: "asc" }],
    });
    const grouped = new Map();
    for (const item of values) {
      const name = specName(item.name),
        value = specValue(item.value);
      if (!grouped.has(name)) grouped.set(name, new Set());
      grouped.get(name).add(value);
    }
    res.json({
      specifications: [...grouped].map(([name, values]) => ({
        name,
        values: [...values],
      })),
      useCases,
    });
  });
  app.get("/api/products", async (req, res) => {
    const query = validate(productQuery, req.query);
    const where = {
      active: true,
      ...(query.category ? { categoryId: query.category } : {}),
      ...(query.brand ? { brandId: query.brand } : {}),
      ...(query.min_price !== undefined || query.max_price !== undefined
        ? {
            price: {
              ...(query.min_price !== undefined
                ? { gte: query.min_price }
                : {}),
              ...(query.max_price !== undefined
                ? { lte: query.max_price }
                : {}),
            },
          }
        : {}),
      ...(query.in_stock === "true" ? { stock: { gt: 0 } } : {}),
      ...(query.use_case ? { useCases: { has: query.use_case } } : {}),
      ...(query.q
        ? {
            OR: ["name", "sku", "description"]
              .map((field) => ({
                [field]: { contains: query.q, mode: "insensitive" },
              }))
              .concat({
                brand: { name: { contains: query.q, mode: "insensitive" } },
              }),
          }
        : {}),
      AND: Object.entries(query.spec).map(([name, value]) => ({
        specs: {
          some: {
            name: { equals: name, mode: "insensitive" },
            value: { equals: value, mode: "insensitive" },
          },
        },
      })),
    };
    const order = {
      featured: { id: "asc" },
      price_asc: { price: "asc" },
      price_desc: { price: "desc" },
      name: { name: "asc" },
      newest: { createdAt: "desc" },
    };
    const pageSize = 9;
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [order[query.sort], { id: "asc" }],
        skip: (query.page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);
    res.json({ products, total, page: query.page, pageSize });
  });
  app.get("/api/products/:id", async (req, res) => {
    const parsed = positiveId.safeParse(req.params.id);
    if (!parsed.success) throw httpError(404, "Product not found.");
    const product = await prisma.product.findFirst({
      where: { id: parsed.data, active: true },
      include: productInclude,
    });
    if (!product) throw httpError(404, "Product not found.");
    res.json({ product });
  });
}
