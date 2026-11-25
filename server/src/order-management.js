import { Router } from "express";
import { z } from "zod";
import { validate, httpError } from "./http-errors.js";
import { orderSelect } from "./order-data.js";

const statuses = ["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED"];
const paymentStatuses = ["PENDING", "PAID", "FAILED", "REFUNDED"];
const nextStatus = {
  PENDING: "CONFIRMED",
  CONFIRMED: "SHIPPING",
  SHIPPING: "DELIVERED",
};
const version = z.number().int().nonnegative().max(2147483646);
const expectedVersion = z.object({ version }).strict();
const filters = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    q: z.string().trim().max(80).optional(),
    status: z.enum(statuses).optional(),
    paymentStatus: z.enum(paymentStatuses).optional(),
    paymentMethod: z.enum(["COD", "SIMULATED"]).optional(),
    after: z.iso.date().optional(),
    before: z.iso.date().optional(),
  })
  .strict()
  .refine(
    (v) => !v.after || !v.before || v.after <= v.before,
    "Start date must not be after end date.",
  );
function stale(order, requestedVersion) {
  if (order.version !== requestedVersion)
    throw httpError(
      409,
      "This order changed. Refresh its details before trying again.",
      undefined,
      "ORDER_CHANGED",
    );
}
// Order mutations lock Order first. Cancellation then locks Products by ascending ID.
// They never take User locks, so checkout's User → Product locks cannot form a cycle.
async function lockedOrder(tx, id, user, admin) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
  const order = await tx.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order || (!admin && order.userId !== user.id))
    throw httpError(404, "Order not found.");
  return order;
}
async function record(tx, order, user, action, changes) {
  return tx.order.update({
    where: { id: order.id },
    data: {
      ...changes,
      version: { increment: 1 },
      events: {
        create: {
          action,
          actorRole: user.role,
          status: changes.status ?? order.status,
          paymentStatus: changes.paymentStatus ?? order.paymentStatus,
        },
      },
    },
    select: orderSelect,
  });
}
async function cancel(tx, order, user) {
  if (order.status !== "PENDING")
    throw httpError(409, "Only Pending orders can be cancelled.");
  for (const item of [...order.items].sort(
    (a, b) => a.productId - b.productId,
  )) {
    await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${item.productId} FOR UPDATE`;
    const updated = await tx.product.updateMany({
      where: { id: item.productId, stock: { lte: 2147483647 - item.quantity } },
      data: { stock: { increment: item.quantity }, version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw httpError(
        409,
        "Stock cannot be restored. Ask an administrator to review inventory.",
      );
  }
  return record(tx, order, user, "CANCELLED", {
    status: "CANCELLED",
    ...(order.paymentMethod === "SIMULATED" && order.paymentStatus === "PAID"
      ? { paymentStatus: "REFUNDED" }
      : {}),
  });
}
export function registerOrderManagement(app, { prisma, requireUser }) {
  const router = Router();
  router.use(["/orders", "/admin/orders"], requireUser);
  router.use("/admin/orders", (req, _res, next) => {
    if (req.user.role !== "ADMIN")
      return next(httpError(403, "Administrator access is required."));
    next();
  });
  async function list(req, res, admin) {
    const input = validate(filters, req.query);
    const where = {
      ...(!admin ? { userId: req.user.id } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.paymentStatus ? { paymentStatus: input.paymentStatus } : {}),
      ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
      ...(input.after || input.before
        ? {
            createdAt: {
              ...(input.after
                ? { gte: new Date(`${input.after}T00:00:00Z`) }
                : {}),
              ...(input.before
                ? {
                    lt: new Date(
                      new Date(`${input.before}T00:00:00Z`).getTime() +
                        86400000,
                    ),
                  }
                : {}),
            },
          }
        : {}),
      ...(input.q
        ? {
            OR: [
              { reference: { contains: input.q, mode: "insensitive" } },
              ...(admin
                ? [
                    {
                      recipientName: { contains: input.q, mode: "insensitive" },
                    },
                    {
                      user: {
                        email: { contains: input.q, mode: "insensitive" },
                      },
                    },
                  ]
                : []),
            ],
          }
        : {}),
    };
    const [orders, total] = await prisma.$transaction(
      [
        prisma.order.findMany({
          where,
          select: {
            id: true,
            reference: true,
            total: true,
            status: true,
            paymentMethod: true,
            paymentStatus: true,
            createdAt: true,
            ...(admin
              ? { recipientName: true, user: { select: { email: true } } }
              : {}),
          },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          skip: (input.page - 1) * 10,
          take: 10,
        }),
        prisma.order.count({ where }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    res.json({ orders, total, page: input.page, pageSize: 10 });
  }
  async function detail(req, res, admin) {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, ...(!admin ? { userId: req.user.id } : {}) },
      select: {
        ...orderSelect,
        ...(admin
          ? {
              user: {
                select: { id: true, name: true, email: true, active: true },
              },
            }
          : {}),
      },
    });
    if (!order) throw httpError(404, "Order not found.");
    res.json({ order });
  }
  router.get("/orders", (req, res) => list(req, res, false));
  router.get("/orders/:id", (req, res) => detail(req, res, false));
  router.get("/admin/orders", (req, res) => list(req, res, true));
  router.get("/admin/orders/:id", (req, res) => detail(req, res, true));
  const transaction = (work) =>
    prisma.$transaction(work, { timeout: 15000, maxWait: 10000 });
  router.post("/orders/:id/cancel", async (req, res) => {
    const input = validate(expectedVersion, req.body);
    const order = await transaction(async (tx) => {
      const current = await lockedOrder(tx, req.params.id, req.user, false);
      if (current.status === "CANCELLED")
        return tx.order.findUnique({
          where: { id: current.id },
          select: orderSelect,
        });
      stale(current, input.version);
      return cancel(tx, current, req.user);
    });
    res.json({ order });
  });
  router.post("/orders/:id/simulated-payment", async (req, res) => {
    const input = validate(
      z.object({ version, outcome: z.enum(["SUCCESS", "FAILURE"]) }).strict(),
      req.body,
    );
    const order = await transaction(async (tx) => {
      const current = await lockedOrder(tx, req.params.id, req.user, false);
      if (current.paymentMethod !== "SIMULATED")
        throw httpError(409, "This order uses cash on delivery.");
      if (current.status !== "PENDING")
        throw httpError(
          409,
          "Simulated payment is only available for Pending orders.",
        );
      const target = input.outcome === "SUCCESS" ? "PAID" : "FAILED";
      if (current.paymentStatus === target)
        return tx.order.findUnique({
          where: { id: current.id },
          select: orderSelect,
        });
      if (current.paymentStatus === "PAID")
        throw httpError(409, "This simulated payment has already succeeded.");
      stale(current, input.version);
      return record(
        tx,
        current,
        req.user,
        target === "PAID" ? "SIMULATED_PAID" : "SIMULATED_FAILED",
        { paymentStatus: target },
      );
    });
    res.json({ order });
  });
  router.patch("/admin/orders/:id/status", async (req, res) => {
    const input = validate(
      z.object({ version, status: z.enum(statuses) }).strict(),
      req.body,
    );
    const order = await transaction(async (tx) => {
      const current = await lockedOrder(tx, req.params.id, req.user, true);
      if (current.status === input.status)
        return tx.order.findUnique({
          where: { id: current.id },
          select: orderSelect,
        });
      stale(current, input.version);
      if (input.status === "CANCELLED") return cancel(tx, current, req.user);
      if (nextStatus[current.status] !== input.status)
        throw httpError(
          409,
          "Follow Pending → Confirmed → Shipping → Delivered. Only Pending orders can be cancelled.",
        );
      if (
        current.paymentMethod === "SIMULATED" &&
        current.paymentStatus !== "PAID"
      )
        throw httpError(
          409,
          "The customer must complete the simulated payment before confirmation.",
        );
      return record(tx, current, req.user, input.status, {
        status: input.status,
      });
    });
    res.json({ order });
  });
  router.post("/admin/orders/:id/collect-cod", async (req, res) => {
    const input = validate(expectedVersion, req.body);
    const order = await transaction(async (tx) => {
      const current = await lockedOrder(tx, req.params.id, req.user, true);
      if (current.paymentMethod !== "COD" || current.status !== "DELIVERED")
        throw httpError(409, "Confirm COD collection only after delivery.");
      if (current.paymentStatus === "PAID")
        return tx.order.findUnique({
          where: { id: current.id },
          select: orderSelect,
        });
      stale(current, input.version);
      return record(tx, current, req.user, "COD_COLLECTED", {
        paymentStatus: "PAID",
      });
    });
    res.json({ order });
  });
  app.use("/api", router);
}
