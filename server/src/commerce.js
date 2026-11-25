import { createHash, randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { validate, httpError } from "./http-errors.js";
import { positiveId } from "./catalog.js";

const sha = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const shipping = z
  .object({
    recipientName: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .trim()
      .regex(/^[+\d\s().-]{7,20}$/, "Enter a valid phone number."),
    address: z
      .string()
      .trim()
      .min(10, "Enter a complete delivery address.")
      .max(500),
    paymentMethod: z.literal("COD"),
    cartToken: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const orderSelect = {
  id: true,
  reference: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  recipientName: true,
  phone: true,
  address: true,
  subtotal: true,
  shippingFee: true,
  total: true,
  createdAt: true,
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      productId: true,
      productName: true,
      sku: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
    },
  },
};

// All cart writes and checkout serialize on this customer's row, across all backend processes.
export async function lockCustomer(tx, userId) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
}

export async function readCart(tx, userId, shippingFee) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { cartVersion: true },
  });
  const rows = await tx.cartItem.findMany({
    where: { userId },
    include: {
      product: {
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      },
    },
    orderBy: { productId: "asc" },
  });
  const items = rows.map(({ quantity, product }) => ({
    productId: product.id,
    name: product.name,
    sku: product.sku,
    quantity,
    unitPrice: product.price.toString(),
    lineTotal: (BigInt(product.price.toString()) * BigInt(quantity)).toString(),
    stock: product.stock,
    active: product.active,
    available: product.active && product.stock >= quantity,
    image: product.images[0] ?? null,
    version: product.version,
  }));
  const subtotal = items.reduce(
    (sum, item) => sum + BigInt(item.lineTotal),
    0n,
  );
  const fee = items.length ? BigInt(shippingFee) : 0n;
  const cart = {
    items,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    version: user.cartVersion,
    subtotal: subtotal.toString(),
    shippingFee: fee.toString(),
    total: (subtotal + fee).toString(),
    canCheckout: items.length > 0 && items.every((item) => item.available),
  };
  return { ...cart, token: sha({ userId, ...cart }) };
}

export function registerCommerce(
  app,
  { prisma, requireUser, shippingFee = "30000" },
) {
  if (!/^\d{1,12}$/.test(String(shippingFee)))
    throw new Error(
      "SHIPPING_FEE_VND must be a nonnegative integer of at most 12 digits.",
    );
  const router = Router();
  router.use("/cart", requireUser);
  router.use("/orders", requireUser);
  router.get("/cart", async (req, res) => {
    const cart = await prisma.$transaction(async (tx) => {
      await lockCustomer(tx, req.user.id);
      return readCart(tx, req.user.id, shippingFee);
    });
    res.json({ cart });
  });
  router.put("/cart/items/:productId", async (req, res) => {
    const productId = validate(positiveId, req.params.productId);
    const { quantity } = validate(
      z.object({ quantity: z.number().int().min(1).max(999) }).strict(),
      req.body,
    );
    const cart = await prisma.$transaction(async (tx) => {
      await lockCustomer(tx, req.user.id);
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product || !product.active)
        throw httpError(409, "This product is no longer available.");
      if (quantity > product.stock)
        throw httpError(409, `Only ${product.stock} unit(s) are available.`, {
          quantity: ["Reduce the quantity."],
        });
      const existing = await tx.cartItem.findUnique({
        where: { userId_productId: { userId: req.user.id, productId } },
      });
      if (
        !existing &&
        (await tx.cartItem.count({ where: { userId: req.user.id } })) >= 100
      )
        throw httpError(
          422,
          "A cart can contain at most 100 different products.",
        );
      await tx.cartItem.upsert({
        where: { userId_productId: { userId: req.user.id, productId } },
        update: { quantity },
        create: { userId: req.user.id, productId, quantity },
      });
      await tx.user.update({
        where: { id: req.user.id },
        data: { cartVersion: { increment: 1 } },
      });
      return readCart(tx, req.user.id, shippingFee);
    });
    res.json({ cart });
  });
  router.delete("/cart/items/:productId", async (req, res) => {
    const productId = validate(positiveId, req.params.productId);
    const cart = await prisma.$transaction(async (tx) => {
      await lockCustomer(tx, req.user.id);
      await tx.cartItem.deleteMany({
        where: { userId: req.user.id, productId },
      });
      await tx.user.update({
        where: { id: req.user.id },
        data: { cartVersion: { increment: 1 } },
      });
      return readCart(tx, req.user.id, shippingFee);
    });
    res.json({ cart });
  });
  router.post("/orders", async (req, res) => {
    const input = validate(shipping, req.body);
    const key = validate(z.string().uuid(), req.get("Idempotency-Key"));
    const requestHash = sha(input);
    const result = await prisma.$transaction(
      async (tx) => {
        await lockCustomer(tx, req.user.id);
        const existing = await tx.order.findUnique({
          where: {
            userId_idempotencyKey: { userId: req.user.id, idempotencyKey: key },
          },
          select: { ...orderSelect, requestHash: true },
        });
        if (existing) {
          if (existing.requestHash !== requestHash)
            throw httpError(
              409,
              "This checkout key was already used for different checkout details.",
            );
          const { requestHash: _hash, ...order } = existing;
          return { order, replayed: true };
        }
        const rows = await tx.cartItem.findMany({
          where: { userId: req.user.id },
          orderBy: { productId: "asc" },
        });
        if (!rows.length)
          throw httpError(
            409,
            "Your cart is empty.",
            undefined,
            "CART_CHANGED",
          );
        // Lock in a fixed order to avoid deadlocks when customers share products.
        for (const row of rows)
          await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${row.productId} FOR UPDATE`;
        const cart = await readCart(tx, req.user.id, shippingFee);
        if (!cart.canCheckout)
          throw httpError(
            409,
            "One or more products are unavailable or have insufficient stock. Review your cart.",
            undefined,
            "CART_CHANGED",
          );
        if (cart.token !== input.cartToken)
          throw httpError(
            409,
            "Your cart, prices, stock, or shipping fee changed. Review the latest totals before confirming.",
            undefined,
            "CART_CHANGED",
          );
        for (const item of cart.items) {
          const updated = await tx.product.updateMany({
            where: {
              id: item.productId,
              active: true,
              stock: { gte: item.quantity },
              version: item.version,
            },
            data: {
              stock: { decrement: item.quantity },
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1)
            throw httpError(
              409,
              "Stock changed. Review your cart.",
              undefined,
              "CART_CHANGED",
            );
        }
        const id = randomUUID();
        const order = await tx.order.create({
          data: {
            id,
            reference: `PC-${id.replaceAll("-", "").slice(0, 16).toUpperCase()}`,
            userId: req.user.id,
            recipientName: input.recipientName,
            phone: input.phone,
            address: input.address,
            paymentMethod: "COD",
            subtotal: cart.subtotal,
            shippingFee: cart.shippingFee,
            total: cart.total,
            idempotencyKey: key,
            requestHash,
            items: {
              create: cart.items.map((item) => ({
                productId: item.productId,
                productName: item.name,
                sku: item.sku,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                lineTotal: item.lineTotal,
              })),
            },
          },
          select: orderSelect,
        });
        // Clearing the purchased cart is atomic with order creation and stock deduction.
        await tx.cartItem.deleteMany({ where: { userId: req.user.id } });
        await tx.user.update({
          where: { id: req.user.id },
          data: { cartVersion: { increment: 1 } },
        });
        return { order, replayed: false };
      },
      { timeout: 15000, maxWait: 10000 },
    );
    res.status(result.replayed ? 200 : 201).json(result);
  });
  router.get("/orders", async (req, res) => {
    const { page } = validate(
      z
        .object({ page: z.coerce.number().int().min(1).max(10000).default(1) })
        .strict(),
      req.query,
    );
    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where: { userId: req.user.id },
        select: {
          id: true,
          reference: true,
          total: true,
          status: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * 10,
        take: 10,
      }),
      prisma.order.count({ where: { userId: req.user.id } }),
    ]);
    res.json({ orders, total, page, pageSize: 10 });
  });
  router.get("/orders/:id", async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: orderSelect,
    });
    if (!order) throw httpError(404, "Order not found.");
    res.json({ order });
  });
  app.use("/api", router);
}
