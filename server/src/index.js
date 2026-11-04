import "dotenv/config";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { createApp } from "./app.js";
import { prisma } from "./db.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const PgStore = connectPgSimple(session);
const store = new PgStore({
  pool,
  tableName: "session",
  createTableIfMissing: false,
});
const app = createApp({
  prisma,
  sessionStore: store,
  sessionSecret: process.env.SESSION_SECRET,
  production: process.env.NODE_ENV === "production",
});
const port = Number(process.env.PORT ?? 3000);

const server = app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    server.close(async () => {
      store.close();
      await Promise.all([pool.end(), prisma.$disconnect()]);
      process.exit(0);
    });
  });
}
