import express from "express";
import session from "express-session";
import { rateLimit } from "express-rate-limit";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { hashPassword, verifyPassword } from "./passwords.js";

const publicUser = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
};
const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8, "Use at least 8 characters.").max(128);
const name = z.string().trim().min(2, "Enter at least 2 characters.").max(80);
const phone = z
  .string()
  .trim()
  .max(20)
  .refine(
    (value) => !value || /^[+\d\s().-]{7,20}$/.test(value),
    "Enter a valid phone number.",
  )
  .optional();
const registration = z.object({ name, email, password, phone }).strict();
const login = z
  .object({ email, password: z.string().min(1).max(128) })
  .strict();
const profile = z.object({ name, phone }).strict();
const productInclude = {
  category: true,
  brand: true,
  specs: { orderBy: { id: "asc" } },
  images: { orderBy: { sortOrder: "asc" } },
};

function validated(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const error = new Error("Please check the highlighted fields.");
    error.status = 422;
    error.fields = result.error.flatten().fieldErrors;
    throw error;
  }
  return result.data;
}

const sessionAction = (req, action) =>
  new Promise((resolve, reject) =>
    req.session[action]((error) => (error ? reject(error) : resolve())),
  );
const newToken = () => randomBytes(32).toString("hex");

export function createApp({
  prisma,
  sessionStore,
  sessionSecret,
  production = false,
}) {
  if (!sessionSecret || sessionSecret.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  const app = express();
  app.disable("x-powered-by");
  if (production) app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    next();
  });
  app.use(express.json({ limit: "16kb" }));

  // Public catalog requests do not need a session or a session cookie.
  app.get("/api/health", async (_req, res) => {
    const categoryCount = await prisma.category.count();
    res.json({ ok: true, database: "connected", categoryCount });
  });
  app.get("/api/categories", async (_req, res) => {
    res.json({
      categories: await prisma.category.findMany({ orderBy: { name: "asc" } }),
    });
  });
  app.get("/api/products", async (req, res) => {
    const query = validated(
      z
        .object({
          page: z.coerce.number().int().min(1).max(10000).default(1),
          category: z.coerce.number().int().positive().optional(),
        })
        .strict(),
      req.query,
    );
    const where = {
      active: true,
      ...(query.category ? { categoryId: query.category } : {}),
    };
    const pageSize = 9;
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { id: "asc" },
        skip: (query.page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);
    res.json({ products, total, page: query.page, pageSize });
  });
  app.get("/api/products/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1)
      return res.status(404).json({ message: "Product not found." });
    const product = await prisma.product.findFirst({
      where: { id, active: true },
      include: productInclude,
    });
    if (!product)
      return res.status(404).json({ message: "Product not found." });
    res.json({ product });
  });

  app.use(
    "/api",
    session({
      name: "pcstore.sid",
      store: sessionStore,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: production,
        maxAge: 1000 * 60 * 60 * 8,
      },
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const token = req.get("X-CSRF-Token");
    const expected = req.session.csrfToken;
    if (
      !/^[a-f0-9]{64}$/.test(token ?? "") ||
      !expected ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
    ) {
      return res
        .status(403)
        .json({
          message:
            "Your session changed or expired. Refresh the page and try again.",
        });
    }
    next();
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again in 15 minutes." },
  });
  async function requireUser(req, res, next) {
    const user = req.session.userId
      ? await prisma.user.findUnique({ where: { id: req.session.userId } })
      : null;
    if (!user?.active)
      return res.status(401).json({ message: "Please sign in to continue." });
    req.user = user;
    next();
  }
  async function signIn(req, res, user, status = 200) {
    await sessionAction(req, "regenerate");
    req.session.userId = user.id;
    req.session.csrfToken = newToken();
    await sessionAction(req, "save");
    const safe = Object.fromEntries(
      Object.keys(publicUser).map((key) => [key, user[key]]),
    );
    res.status(status).json({ user: safe, csrfToken: req.session.csrfToken });
  }
  app.get("/api/auth/session", async (req, res) => {
    const user = req.session.userId
      ? await prisma.user.findUnique({
          where: { id: req.session.userId },
          select: { ...publicUser, active: true },
        })
      : null;
    req.session.csrfToken ??= newToken();
    if (!user?.active) delete req.session.userId;
    await sessionAction(req, "save");
    if (user) delete user.active;
    res.json({
      user: req.session.userId ? user : null,
      csrfToken: req.session.csrfToken,
    });
  });
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const input = validated(registration, req.body);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        passwordHash: await hashPassword(input.password),
      },
    });
    await signIn(req, res, user, 201);
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const input = validated(login, req.body);
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });
    // Keep failed account and password checks on the same hashing path.
    const fallback =
      "scrypt:00000000000000000000000000000000:" + "0".repeat(128);
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash ?? fallback,
    );
    if (!user?.active || !valid)
      return res
        .status(401)
        .json({ message: "Email or password is incorrect." });
    await signIn(req, res, user);
  });
  app.post("/api/auth/logout", async (req, res) => {
    await sessionAction(req, "destroy");
    res.clearCookie("pcstore.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: production,
      path: "/",
    });
    res.json({ message: "Signed out." });
  });
  app.patch("/api/account", requireUser, async (req, res) => {
    const input = validated(profile, req.body);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name: input.name, phone: input.phone || null },
      select: publicUser,
    });
    res.json({ user });
  });
  app.get("/api/admin/overview", requireUser, async (req, res) => {
    if (req.user.role !== "ADMIN")
      return res
        .status(403)
        .json({ message: "Administrator access is required." });
    const [products, customers] = await prisma.$transaction([
      prisma.product.count({ where: { active: true } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
    ]);
    res.json({ products, customers });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ message: "Endpoint not found." }),
  );
  app.use((error, _req, res, _next) => {
    if (error.code === "P2002")
      return res
        .status(409)
        .json({
          message: "This email is already registered.",
          fields: { email: ["Use another email or sign in."] },
        });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ message: "Invalid JSON request." });
    if (error.type === "entity.too.large")
      return res.status(413).json({ message: "Request is too large." });
    if (error.status === 422)
      return res
        .status(422)
        .json({ message: error.message, fields: error.fields });
    console.error(error);
    res
      .status(503)
      .json({
        message: "The service is temporarily unavailable. Please try again.",
      });
  });
  return app;
}
