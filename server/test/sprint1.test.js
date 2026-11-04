import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { once } from "node:events";
import pg from "pg";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createApp } from "../src/app.js";
import { hashPassword, verifyPassword } from "../src/passwords.js";
import { seedCatalog } from "../prisma/seed-data.js";

test("password hashes use independent salts and reject incorrect or malformed credentials", async () => {
  const first = await hashPassword("Example-password-123");
  const second = await hashPassword("Example-password-123");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("Example-password-123", first), true);
  assert.equal(await verifyPassword("wrong", first), false);
  assert.equal(await verifyPassword("Example-password-123", "broken"), false);
});

test(
  "Sprint 1 HTTP and database integration",
  {
    skip:
      !process.env.TEST_DATABASE_URL &&
      "Set TEST_DATABASE_URL to run database integration checks.",
  },
  async (t) => {
    // Every run creates and drops only its own random schema, never public tables.
    const connectionString = process.env.TEST_DATABASE_URL;
    const schema = `sprint1_${randomUUID().replaceAll("-", "")}`;
    const adminPool = new pg.Pool({ connectionString, max: 1 });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const pool = new pg.Pool({ connectionString, max: 1 });
    const prisma = new PrismaClient({
      adapter: new PrismaPg(pool, { schema }),
    });
    const PgStore = connectPgSimple(session);
    const stores = [];
    const servers = [];
    t.after(async () => {
      for (const server of servers)
        await new Promise((resolve) => server.close(resolve));
      for (const store of stores) store.close();
      await prisma.$disconnect();
      await pool.end();
      await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
      await adminPool.end();
    });
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schema}"`);
      const migrationRoot = new URL("../prisma/migrations/", import.meta.url);
      for (const entry of (
        await readdir(migrationRoot, { withFileTypes: true })
      )
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name))) {
        await client.query(
          await readFile(
            new URL(`${entry.name}/migration.sql`, migrationRoot),
            "utf8",
          ),
        );
      }
    } finally {
      client.release();
    }
    await seedCatalog(prisma);
    async function start() {
      const store = new PgStore({
        pool,
        schemaName: schema,
        pruneSessionInterval: false,
      });
      stores.push(store);
      const app = createApp({
        prisma,
        sessionStore: store,
        sessionSecret: "integration-secret-longer-than-32-characters",
      });
      const server = app.listen(0, "127.0.0.1");
      servers.push(server);
      await once(server, "listening");
      return `http://127.0.0.1:${server.address().port}`;
    }
    const base = await start();
    function browser() {
      return {
        cookie: "",
        token: "",
        async request(
          path,
          { method = "GET", body, csrf = true, origin = base } = {},
        ) {
          const response = await fetch(`${origin}/api${path}`, {
            method,
            headers: {
              ...(this.cookie ? { Cookie: this.cookie } : {}),
              ...(body ? { "Content-Type": "application/json" } : {}),
              ...(method !== "GET" && csrf
                ? { "X-CSRF-Token": this.token }
                : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
          const cookies = response.headers.getSetCookie();
          if (cookies.length) this.cookie = cookies.at(-1).split(";")[0];
          const data = await response.json();
          if (data.csrfToken) this.token = data.csrfToken;
          return { status: response.status, data, cookies };
        },
      };
    }
    const customer = browser();
    const email = "learner@example.test";
    const password = "Example-password-123";
    let productId;
    let userId;
    await t.test(
      "public catalog returns seeded stock, decimal prices, specifications, and category filtering",
      async () => {
        const result = await customer.request("/products");
        assert.equal(result.status, 200);
        assert.equal(result.data.total, 6);
        productId = result.data.products[0].id;
        assert.equal(typeof result.data.products[0].price, "string");
        assert.ok(result.data.products[0].specs.length);
        assert.ok(result.data.products.some((item) => item.stock === 0));
        const categoryId = result.data.products[0].categoryId;
        const filtered = await customer.request(
          `/products?category=${categoryId}`,
        );
        assert.ok(
          filtered.data.products.every(
            (item) => item.categoryId === categoryId,
          ),
        );
        assert.equal((await customer.request("/products?page=-1")).status, 422);
        assert.equal(customer.cookie, "");
      },
    );
    await t.test(
      "hidden and missing products cannot be read directly",
      async () => {
        assert.equal(
          (await customer.request(`/products/${productId}`)).status,
          200,
        );
        assert.equal(
          (await customer.request("/products/not-an-id")).status,
          404,
        );
        await prisma.product.update({
          where: { id: productId },
          data: { active: false },
        });
        assert.equal(
          (await customer.request(`/products/${productId}`)).status,
          404,
        );
        assert.equal((await customer.request("/products")).data.total, 5);
        await prisma.product.update({
          where: { id: productId },
          data: { active: true },
        });
      },
    );
    await t.test("database rejects negative prices and stock", async () => {
      await assert.rejects(
        prisma.product.update({
          where: { id: productId },
          data: { stock: -1 },
        }),
      );
      await assert.rejects(
        prisma.product.update({
          where: { id: productId },
          data: { price: "-1" },
        }),
      );
    });
    await t.test(
      "unauthenticated admin access and missing CSRF tokens are rejected",
      async () => {
        assert.equal((await customer.request("/admin/overview")).status, 401);
        assert.equal(
          (
            await customer.request("/auth/register", {
              method: "POST",
              csrf: false,
              body: { name: "Learner", email, password },
            })
          ).status,
          403,
        );
        await customer.request("/auth/session");
      },
    );
    await t.test(
      "registration validates input and never accepts an injected role",
      async () => {
        assert.equal(
          (
            await customer.request("/auth/register", {
              method: "POST",
              body: { name: "L", email, password: "short" },
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await customer.request("/auth/register", {
              method: "POST",
              body: { name: "Learner", email, password, role: "ADMIN" },
            })
          ).status,
          422,
        );
      },
    );
    await t.test(
      "registration hashes credentials, normalizes email, rotates the session, and returns safe fields",
      async () => {
        const oldCookie = customer.cookie;
        const result = await customer.request("/auth/register", {
          method: "POST",
          body: { name: "Learner", email: "LEARNER@EXAMPLE.TEST", password },
        });
        assert.equal(result.status, 201);
        userId = result.data.user.id;
        assert.equal(result.data.user.role, "CUSTOMER");
        assert.equal(result.data.user.email, email);
        assert.equal(result.data.user.passwordHash, undefined);
        assert.notEqual(customer.cookie, oldCookie);
        assert.match(result.cookies[0], /HttpOnly/i);
        assert.match(result.cookies[0], /SameSite=Lax/i);
        const stored = await prisma.user.findUnique({ where: { id: userId } });
        assert.notEqual(stored.passwordHash, password);
        assert.equal(await verifyPassword(password, stored.passwordHash), true);
      },
    );
    await t.test("duplicate email returns a field error", async () => {
      const other = browser();
      await other.request("/auth/session");
      const result = await other.request("/auth/register", {
        method: "POST",
        body: { name: "Other Learner", email, password },
      });
      assert.equal(result.status, 409);
      assert.ok(result.data.fields.email);
    });
    await t.test(
      "profile changes persist without allowing role escalation",
      async () => {
        const result = await customer.request("/account", {
          method: "PATCH",
          body: { name: "Updated Learner", phone: "+84 912 345 678" },
        });
        assert.equal(result.status, 200);
        assert.equal(result.data.user.name, "Updated Learner");
        assert.equal(
          (await customer.request("/auth/session")).data.user.phone,
          "+84 912 345 678",
        );
        assert.equal(
          (
            await customer.request("/account", {
              method: "PATCH",
              body: { name: "Admin", role: "ADMIN" },
            })
          ).status,
          422,
        );
        assert.equal((await customer.request("/admin/overview")).status, 403);
      },
    );
    await t.test("sessions survive a new application instance", async () => {
      const secondBase = await start();
      const result = await customer.request("/auth/session", {
        origin: secondBase,
      });
      assert.equal(result.data.user.id, userId);
    });
    await t.test("logout invalidates the previous session", async () => {
      const savedCookie = customer.cookie;
      assert.equal(
        (await customer.request("/auth/logout", { method: "POST" })).status,
        200,
      );
      const stale = browser();
      stale.cookie = savedCookie;
      assert.equal((await stale.request("/auth/session")).data.user, null);
    });
    await t.test(
      "login rejects incorrect credentials and accepts the registered password",
      async () => {
        await customer.request("/auth/session");
        assert.equal(
          (
            await customer.request("/auth/login", {
              method: "POST",
              body: { email, password: "incorrect" },
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await customer.request("/auth/login", {
              method: "POST",
              body: { email, password },
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "disabled accounts lose access even with an existing session",
      async () => {
        await prisma.user.update({
          where: { id: userId },
          data: { active: false },
        });
        assert.equal(
          (
            await customer.request("/account", {
              method: "PATCH",
              body: { name: "Still Here" },
            })
          ).status,
          401,
        );
        assert.equal((await customer.request("/auth/session")).data.user, null);
      },
    );
    await t.test("administrator role is enforced by the backend", async () => {
      const admin = browser();
      await admin.request("/auth/session");
      await prisma.user.create({
        data: {
          name: "Administrator",
          email: "admin@example.test",
          role: "ADMIN",
          passwordHash: await hashPassword(password),
        },
      });
      assert.equal(
        (
          await admin.request("/auth/login", {
            method: "POST",
            body: { email: "admin@example.test", password },
          })
        ).status,
        200,
      );
      const result = await admin.request("/admin/overview");
      assert.equal(result.status, 200);
      assert.equal(result.data.products, 6);
    });
    await t.test(
      "rerunning the seed preserves edits and avoids duplicate products",
      async () => {
        await prisma.product.update({
          where: { id: productId },
          data: { stock: 3 },
        });
        await seedCatalog(prisma);
        assert.equal(await prisma.product.count(), 6);
        assert.equal(
          (await prisma.product.findUnique({ where: { id: productId } })).stock,
          3,
        );
      },
    );
  },
);
