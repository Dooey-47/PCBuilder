import { prisma } from "../src/db.js";
import { hashPassword } from "../src/passwords.js";
import { seedCatalog } from "./seed-data.js";

try {
  const email = process.env.DEMO_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (Boolean(email) !== Boolean(password))
    throw new Error(
      "Set both DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD, or neither.",
    );
  if (
    email &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 ||
      password.length > 128)
  ) {
    throw new Error(
      "Use a valid demo admin email and a password of 8–128 characters.",
    );
  }
  await seedCatalog(prisma);
  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.role !== "ADMIN")
      throw new Error(
        "That demo admin email belongs to a customer. Choose a different email.",
      );
    if (!existing)
      await prisma.user.create({
        data: {
          email,
          name: "Demo Administrator",
          role: "ADMIN",
          passwordHash: await hashPassword(password),
        },
      });
    console.log(
      "Demo administrator is available. Existing account passwords were not changed.",
    );
  }
  console.log(
    "Seed complete: 5 categories and 6 demo products. Existing records were preserved.",
  );
} catch (error) {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
