import { randomUUID } from "node:crypto";
import { readdir, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import pg from "pg";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/passwords.js";
import { seedCatalog } from "../prisma/seed-data.js";

export async function fixture(t, { beforeLatest } = {}) {
  const schema = `sprint2_${randomUUID().replaceAll("-", "")}`;
  const connectionString = process.env.TEST_DATABASE_URL;
  const setup = new pg.Pool({ connectionString, max: 1 });
  await setup.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    options: `-c search_path=${schema}`,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
  const uploads = await mkdtemp(join(tmpdir(), "pcbuilder-uploads-"));
  const PgStore = connectPgSimple(session);
  const store = new PgStore({
    pool,
    schemaName: schema,
    pruneSessionInterval: false,
  });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await store.close();
    await prisma.$disconnect();
    await pool.end();
    await setup.query(`DROP SCHEMA "${schema}" CASCADE`);
    await setup.end();
    await rm(uploads, { recursive: true, force: true });
  });
  const client = await pool.connect();
  try {
    const root = new URL("../prisma/migrations/", import.meta.url);
    for (const entry of (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === "20261125090000_sprint2_commerce" && beforeLatest)
        await beforeLatest(client);
      await client.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );
    }
  } finally {
    client.release();
  }
  await seedCatalog(prisma);
  server = createApp({
    prisma,
    sessionStore: store,
    sessionSecret: "test-secret-at-least-32-characters-long",
    uploadDir: uploads,
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  function browser() {
    return {
      cookie: "",
      token: "",
      async request(
        path,
        { method = "GET", body, headers = {}, csrf = true } = {},
      ) {
        const multipart = body instanceof FormData;
        const response = await fetch(`${base}/api${path}`, {
          method,
          headers: {
            ...headers,
            ...(this.cookie ? { Cookie: this.cookie } : {}),
            ...(body && !multipart
              ? { "Content-Type": "application/json" }
              : {}),
            ...(method !== "GET" && csrf ? { "X-CSRF-Token": this.token } : {}),
          },
          ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length) this.cookie = cookies.at(-1).split(";")[0];
        const data = response.headers
          .get("Content-Type")
          ?.includes("application/json")
          ? await response.json()
          : new Uint8Array(await response.arrayBuffer());
        if (data.csrfToken) this.token = data.csrfToken;
        return { status: response.status, data, headers: response.headers };
      },
    };
  }
  const password = "Integration-pass-123",
    passwordHash = await hashPassword(password);
  async function account(role = "CUSTOMER") {
    const user = await prisma.user.create({
      data: {
        name: "Integration Learner",
        email: `${randomUUID()}@example.test`,
        passwordHash,
        role,
      },
    });
    const client = browser();
    await client.request("/auth/session");
    const login = await client.request("/auth/login", {
      method: "POST",
      body: { email: user.email, password },
    });
    if (login.status !== 200)
      throw new Error(`Test login failed: ${login.status}`);
    return Object.assign(client, { user });
  }
  return { prisma, pool, schema, uploads, browser, account, base };
}
