import "dotenv/config";
import express from "express";
import { prisma } from "./db.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    const categoryCount = await prisma.category.count();

    res.json({
      ok: true,
      database: "connected",
      categoryCount,
    });
  } catch (error) {
    console.error(error);

    res.status(503).json({
      ok: false,
      database: "unavailable",
    });
  }
});

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});