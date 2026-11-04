export const categoryNames = [
  "Laptops",
  "Desktop PCs",
  "PC Components",
  "Peripherals",
  "Accessories",
];

// Illustrative demo configurations and prices, not live retailer listings.
const products = [
  {
    sku: "DEMO-LAP-01",
    name: "Aster Air 14",
    brand: "Aster",
    category: "Laptops",
    price: "18990000",
    stock: 12,
    image: "laptop",
    description:
      "A lightweight everyday laptop for classes, office work, and your next project. A clean 14-inch display and generous memory make multitasking feel effortless.",
    specs: {
      Processor: "Intel Core i5",
      Memory: "16 GB",
      Storage: "512 GB SSD",
      Display: "14-inch Full HD",
      Weight: "1.4 kg",
    },
  },
  {
    sku: "DEMO-LAP-02",
    name: "Aster Studio 16",
    brand: "Aster",
    category: "Laptops",
    price: "28990000",
    stock: 6,
    image: "laptop",
    description:
      "More room for your ideas. A larger display and dedicated graphics suit creative coursework, editing, and demanding everyday tasks.",
    specs: {
      Processor: "Intel Core i7",
      Memory: "32 GB",
      Storage: "1 TB SSD",
      Display: "16-inch 2.5K",
      Graphics: "Dedicated 6 GB",
    },
  },
  {
    sku: "DEMO-PC-01",
    name: "Vertex Workstation S",
    brand: "Vertex",
    category: "Desktop PCs",
    price: "22490000",
    stock: 8,
    image: "desktop",
    description:
      "A balanced desktop built for focused work and comfortable multitasking. Includes the tower only; choose your own monitor and peripherals.",
    specs: {
      Processor: "AMD Ryzen 5",
      Memory: "32 GB",
      Storage: "1 TB SSD",
      Graphics: "Dedicated 8 GB",
      "Power supply": "650 W",
    },
  },
  {
    sku: "DEMO-GPU-01",
    name: "Vertex Graphics G8",
    brand: "Vertex",
    category: "PC Components",
    price: "8490000",
    stock: 0,
    image: "gpu",
    description:
      "An illustrative graphics card for your next desktop build. This demo item is out of stock so you can check the storefront's availability states.",
    specs: {
      Memory: "8 GB GDDR6",
      Interface: "PCIe 4.0",
      Cooling: "Dual fan",
      "Recommended PSU": "550 W",
    },
  },
  {
    sku: "DEMO-MON-01",
    name: "Clarity View 27",
    brand: "Clarity",
    category: "Peripherals",
    price: "4990000",
    stock: 15,
    image: "monitor",
    description:
      "A spacious, crisp display for code, coursework, and everything in between. A simple stand keeps your workspace uncluttered.",
    specs: {
      Display: "27-inch IPS",
      Resolution: "2560 × 1440",
      "Refresh rate": "100 Hz",
      Connections: "HDMI / DisplayPort",
    },
  },
  {
    sku: "DEMO-KEY-01",
    name: "Orbit Keys 75",
    brand: "Orbit",
    category: "Accessories",
    price: "1490000",
    stock: 24,
    image: "keyboard",
    description:
      "A compact mechanical keyboard that leaves more space on your desk. A comfortable layout for long study sessions and everyday work.",
    specs: {
      Layout: "75% / 84 keys",
      Switches: "Mechanical linear",
      Connection: "USB-C",
      Backlight: "White LED",
    },
  },
];

export async function seedCatalog(db) {
  await db.$transaction(
    async (tx) => {
      const categories = new Map();
      for (const name of categoryNames) {
        categories.set(
          name,
          await tx.category.upsert({
            where: { name },
            update: {},
            create: { name },
          }),
        );
      }
      for (const item of products) {
        const brand = await tx.brand.upsert({
          where: { name: item.brand },
          update: {},
          create: { name: item.brand },
        });
        const product = await tx.product.upsert({
          where: { sku: item.sku },
          update: {},
          create: {
            sku: item.sku,
            name: item.name,
            description: item.description,
            price: item.price,
            stock: item.stock,
            warrantyText:
              "24-month limited warranty. Demo terms for this exercise.",
            categoryId: categories.get(item.category).id,
            brandId: brand.id,
          },
        });
        for (const [name, value] of Object.entries(item.specs)) {
          await tx.productSpec.upsert({
            where: { productId_name: { productId: product.id, name } },
            update: {},
            create: { productId: product.id, name, value },
          });
        }
        await tx.productImage.upsert({
          where: {
            productId_sortOrder: { productId: product.id, sortOrder: 0 },
          },
          update: {},
          create: {
            productId: product.id,
            sortOrder: 0,
            url: `/images/${item.image}.svg`,
            alt: `${item.name} — illustrative product image`,
          },
        });
      }
    },
    { timeout: 30000 },
  );
}
