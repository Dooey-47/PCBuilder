import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture } from "./helpers.mjs";

test(
  "Sprint 2 migration preserves a populated Sprint 1 database",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const f = await fixture(t, {
      beforeLatest: async (client) => {
        await client.query(`INSERT INTO "Category" ("name") VALUES ('Laptops'); INSERT INTO "Brand" ("name") VALUES ('Aster');
      INSERT INTO "User" ("email", "passwordHash", "name", "updatedAt") VALUES ('legacy@example.test', 'existing-password-hash', 'Existing Learner', NOW());
      INSERT INTO "Product" ("sku", "name", "description", "price", "stock", "warrantyText", "categoryId", "brandId", "updatedAt")
      VALUES ('DEMO-LAP-01', 'Edited before upgrade', 'Existing product description', 777777, 4, 'Existing warranty',
        (SELECT "id" FROM "Category" WHERE "name" = 'Laptops'), (SELECT "id" FROM "Brand" WHERE "name" = 'Aster'), NOW());`);
      },
    });
    const product = await f.prisma.product.findUnique({
      where: { sku: "DEMO-LAP-01" },
    });
    assert.equal(product.name, "Edited before upgrade");
    assert.equal(product.price.toString(), "777777");
    assert.equal(product.stock, 4);
    assert.deepEqual(product.useCases, ["study", "office"]);
    const user = await f.prisma.user.findUnique({
      where: { email: "legacy@example.test" },
    });
    assert.equal(user.name, "Existing Learner");
    assert.equal(user.passwordHash, "existing-password-hash");
    assert.equal(user.cartVersion, 0);
  },
);

test(
  "Sprint 2 catalog, cart, administration and COD checkout",
  {
    skip:
      !process.env.TEST_DATABASE_URL &&
      "Set TEST_DATABASE_URL to enable PostgreSQL integration tests.",
  },
  async (t) => {
    const f = await fixture(t),
      { prisma, pool } = f;
    const admin = await f.account("ADMIN"),
      customer = await f.account(),
      other = await f.account();
    const list = await customer.request("/products"),
      first = list.data.products[0];
    let serial = 0;
    async function product(stock = 5) {
      const result = await admin.request("/admin/products", {
        method: "POST",
        body: {
          sku: `TEST-${++serial}`,
          name: `Test product ${serial}`,
          description: "A product used by integration tests.",
          price: "100000",
          stock,
          active: true,
          warrantyText: "12 months",
          categoryId: first.categoryId,
          brandId: first.brandId,
          useCases: ["study"],
          specs: [{ name: "RAM", value: "16gb" }],
          images: [{ url: "/images/laptop.svg", alt: "Test laptop" }],
        },
      });
      assert.equal(result.status, 201, JSON.stringify(result.data));
      return result.data.product;
    }
    async function cartFor(client, item, quantity = 1) {
      const updated = await client.request(`/cart/items/${item.id}`, {
        method: "PUT",
        body: { quantity },
      });
      assert.equal(updated.status, 200, JSON.stringify(updated.data));
      return updated.data.cart;
    }
    const delivery = (cart) => ({
      recipientName: "Demo Recipient",
      phone: "+84 912 345 678",
      address: "123 Example Street, Ho Chi Minh City",
      paymentMethod: "COD",
      cartToken: cart.token,
    });
    const checkout = (client, body, key = randomUUID()) =>
      client.request("/orders", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": key },
      });
    const clear = async (client) => {
      const cart = await client.request("/cart");
      for (const item of cart.data.cart.items)
        await client.request(`/cart/items/${item.productId}`, {
          method: "DELETE",
        });
    };

    await t.test(
      "search, brand, price, stock, use case, normalized specs and sorting combine",
      async () => {
        const params = new URLSearchParams({
          q: "aster",
          brand: String(first.brandId),
          category: String(first.categoryId),
          min_price: "10000000",
          max_price: "20000000",
          in_stock: "true",
          use_case: "study",
          spec: JSON.stringify({ ram: "16gb" }),
          sort: "price_asc",
        });
        const result = await customer.request(`/products?${params}`);
        assert.equal(result.status, 200);
        assert.equal(result.data.total, 1);
        assert.equal(result.data.products[0].sku, "DEMO-LAP-01");
        assert.equal(
          (await customer.request("/products?min_price=200&max_price=100"))
            .status,
          422,
        );
        assert.equal(
          (await customer.request("/products?spec=broken")).status,
          422,
        );
        const sorted = (
          await customer.request("/products?sort=price_desc")
        ).data.products.map((p) => BigInt(p.price));
        assert.ok(sorted.every((price, i) => !i || sorted[i - 1] >= price));
        assert.ok(
          (
            await customer.request(
              `/catalog-filters?category=${first.categoryId}`,
            )
          ).data.specifications.length,
        );
      },
    );
    await t.test(
      "all admin catalog operations reject Customers and anonymous users",
      async () => {
        assert.equal((await customer.request("/admin/products")).status, 403);
        assert.equal(
          (await f.browser().request("/admin/products")).status,
          401,
        );
        assert.equal(
          (
            await customer.request("/admin/products", {
              method: "POST",
              body: {},
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await customer.request("/admin/categories", {
              method: "POST",
              body: { name: "Forbidden" },
            })
          ).status,
          403,
        );
      },
    );
    await t.test("category and brand CRUD enforce references", async () => {
      for (const kind of ["categories", "brands"]) {
        const created = await admin.request(`/admin/${kind}`, {
          method: "POST",
          body: { name: `New ${kind}` },
        });
        assert.equal(created.status, 201);
        const id = created.data.record.id;
        assert.equal(
          (
            await admin.request(`/admin/${kind}/${id}`, {
              method: "PATCH",
              body: { name: `Renamed ${kind}` },
            })
          ).status,
          200,
        );
        assert.equal(
          (await admin.request(`/admin/${kind}/${id}`, { method: "DELETE" }))
            .status,
          200,
        );
        const usedId = kind === "categories" ? first.categoryId : first.brandId;
        assert.equal(
          (
            await admin.request(`/admin/${kind}/${usedId}`, {
              method: "DELETE",
            })
          ).status,
          409,
        );
      }
    });
    await t.test(
      "product create/update normalizes specs and rejects stale stock edits",
      async () => {
        const item = await product();
        assert.equal(item.specs[0].name, "Memory");
        assert.equal(item.specs[0].value, "16 GB");
        const changed = await admin.request(`/admin/products/${item.id}`, {
          method: "PATCH",
          body: { stock: 7, version: item.version },
        });
        assert.equal(changed.status, 200);
        assert.equal(
          (
            await admin.request(`/admin/products/${item.id}`, {
              method: "PATCH",
              body: { stock: 99, version: item.version },
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await admin.request(`/admin/products/${item.id}`, {
              method: "PATCH",
              body: { stock: -1, version: changed.data.product.version },
            })
          ).status,
          422,
        );
        assert.equal(
          (await prisma.product.findUnique({ where: { id: item.id } })).stock,
          7,
        );
      },
    );
    await t.test(
      "image uploads validate contents, MIME type, size and permissions",
      async () => {
        const png = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSx8AAAAASUVORK5CYII=",
          "base64",
        );
        const form = () => {
          const body = new FormData();
          body.set(
            "image",
            new Blob([png], { type: "image/png" }),
            "pixel.png",
          );
          return body;
        };
        assert.equal(
          (
            await customer.request("/admin/uploads", {
              method: "POST",
              body: form(),
            })
          ).status,
          403,
        );
        const result = await admin.request("/admin/uploads", {
          method: "POST",
          body: form(),
        });
        assert.equal(result.status, 201);
        assert.match(result.data.url, /^\/api\/uploads\/.+\.png$/);
        const delivered = await f
          .browser()
          .request(result.data.url.replace("/api", ""));
        assert.equal(delivered.status, 200);
        assert.equal(delivered.headers.get("Content-Type"), "image/png");
        assert.equal(delivered.data.length, png.length);
        const invalid = new FormData();
        invalid.set(
          "image",
          new Blob(["<svg></svg>"], { type: "image/png" }),
          "fake.png",
        );
        assert.equal(
          (
            await admin.request("/admin/uploads", {
              method: "POST",
              body: invalid,
            })
          ).status,
          422,
        );
        const large = new FormData();
        large.set(
          "image",
          new Blob([Buffer.alloc(2 * 1024 * 1024 + 1)], { type: "image/png" }),
          "large.png",
        );
        assert.equal(
          (
            await admin.request("/admin/uploads", {
              method: "POST",
              body: large,
            })
          ).status,
          413,
        );
      },
    );
    await t.test(
      "cart persists, isolates ownership, validates quantities, and reserves no inventory",
      async () => {
        const item = await product(5);
        const cart = await cartFor(customer, item, 2);
        assert.equal(cart.items[0].quantity, 2);
        assert.equal(cart.subtotal, "200000");
        assert.equal(cart.total, "230000");
        assert.equal((await customer.request("/cart")).data.cart.quantity, 2);
        assert.equal((await other.request("/cart")).data.cart.quantity, 0);
        for (const quantity of [0, -1, 1.5, "2"])
          assert.equal(
            (
              await customer.request(`/cart/items/${item.id}`, {
                method: "PUT",
                body: { quantity },
              })
            ).status,
            422,
          );
        assert.equal(
          (
            await customer.request(`/cart/items/${item.id}`, {
              method: "PUT",
              body: { quantity: 6 },
            })
          ).status,
          409,
        );
        assert.equal(
          (await prisma.product.findUnique({ where: { id: item.id } })).stock,
          5,
        );
        await clear(customer);
      },
    );
    await t.test(
      "hidden products remain removable from carts and cannot be checked out",
      async () => {
        const item = await product();
        await cartFor(customer, item);
        assert.equal(
          (
            await admin.request(`/admin/products/${item.id}`, {
              method: "DELETE",
              body: { version: item.version },
            })
          ).status,
          200,
        );
        const cart = (await customer.request("/cart")).data.cart;
        assert.equal(cart.canCheckout, false);
        assert.equal(cart.items[0].active, false);
        assert.equal((await checkout(customer, delivery(cart))).status, 409);
        await clear(customer);
      },
    );
    await t.test(
      "client totals are rejected and changed prices require review",
      async () => {
        const item = await product(),
          cart = await cartFor(customer, item);
        assert.equal(
          (await checkout(customer, { ...delivery(cart), total: "1" })).status,
          422,
        );
        await admin.request(`/admin/products/${item.id}`, {
          method: "PATCH",
          body: { price: "120000", version: item.version },
        });
        const result = await checkout(customer, delivery(cart));
        assert.equal(result.status, 409);
        assert.equal(result.data.code, "CART_CHANGED");
        assert.equal(
          (await prisma.product.findUnique({ where: { id: item.id } })).stock,
          5,
        );
        await clear(customer);
      },
    );
    let completed;
    await t.test(
      "COD creates immutable snapshots and idempotent concurrent retries create one order",
      async () => {
        const item = await product(5),
          cart = await cartFor(customer, item, 2),
          body = delivery(cart),
          key = randomUUID();
        const results = await Promise.all([
          checkout(customer, body, key),
          checkout(customer, body, key),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
        assert.equal(results[0].data.order.id, results[1].data.order.id);
        completed = results[0].data.order;
        assert.equal(completed.total, "230000");
        assert.equal(completed.paymentStatus, "PENDING");
        assert.equal(completed.status, "PENDING");
        assert.equal(
          (await prisma.product.findUnique({ where: { id: item.id } })).stock,
          3,
        );
        assert.equal((await customer.request("/cart")).data.cart.quantity, 0);
        assert.equal(
          (
            await checkout(
              customer,
              { ...body, address: "Different delivery address" },
              key,
            )
          ).status,
          409,
        );
        const fresh = await prisma.product.findUnique({
          where: { id: item.id },
        });
        await admin.request(`/admin/products/${item.id}`, {
          method: "PATCH",
          body: {
            name: "Renamed after purchase",
            price: "999999",
            version: fresh.version,
          },
        });
        const receipt = (await customer.request(`/orders/${completed.id}`)).data
          .order;
        assert.equal(receipt.items[0].productName, item.name);
        assert.equal(receipt.items[0].unitPrice, "100000");
      },
    );
    await t.test(
      "receipts and order lists cannot expose another customer's order",
      async () => {
        assert.equal(
          (await other.request(`/orders/${completed.id}`)).status,
          404,
        );
        assert.equal((await other.request("/orders")).data.orders.length, 0);
        assert.ok(
          (await customer.request("/orders")).data.orders.some(
            (order) => order.id === completed.id,
          ),
        );
        assert.equal(
          (await f.browser().request(`/orders/${completed.id}`)).status,
          401,
        );
      },
    );
    await t.test(
      "two customers buying the last unit cannot both succeed",
      async () => {
        const item = await product(1);
        const left = await cartFor(customer, item),
          right = await cartFor(other, item);
        const results = await Promise.all([
          checkout(customer, delivery(left)),
          checkout(other, delivery(right)),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
        assert.equal(
          (await prisma.product.findUnique({ where: { id: item.id } })).stock,
          0,
        );
        assert.equal(
          await prisma.orderItem.count({ where: { productId: item.id } }),
          1,
        );
        await clear(customer);
        await clear(other);
      },
    );
    await t.test(
      "two different checkout keys for one cart cannot create two orders",
      async () => {
        const item = await product(5),
          cart = await cartFor(customer, item),
          body = delivery(cart);
        const results = await Promise.all([
          checkout(customer, body),
          checkout(customer, body),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
        assert.equal(
          await prisma.orderItem.count({ where: { productId: item.id } }),
          1,
        );
      },
    );
    await t.test(
      "an order write failure rolls back all deducted stock and preserves the cart",
      async () => {
        const item = await product(4);
        await cartFor(customer, item, 2);
        const cart = (await customer.request("/cart")).data.cart;
        await pool.query(
          `CREATE FUNCTION reject_test_order() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Intentional rollback test'; END $$`,
        );
        await pool.query(
          `CREATE TRIGGER reject_test_order BEFORE INSERT ON "Order" FOR EACH ROW WHEN (NEW."userId" = ${customer.user.id}) EXECUTE FUNCTION reject_test_order()`,
        );
        const previous = console.error;
        console.error = () => {};
        try {
          assert.equal((await checkout(customer, delivery(cart))).status, 503);
        } finally {
          console.error = previous;
          await pool.query('DROP TRIGGER reject_test_order ON "Order"');
        }
        assert.equal(
          (await prisma.product.findUnique({ where: { id: item.id } })).stock,
          4,
        );
        assert.equal(
          (await customer.request("/cart")).data.cart.items[0].quantity,
          2,
        );
        assert.equal(
          await prisma.orderItem.count({ where: { productId: item.id } }),
          0,
        );
        await clear(customer);
      },
    );
    await t.test(
      "pagination is stable and empty results are represented explicitly",
      async () => {
        const page1 = (await customer.request("/products?page=1")).data,
          page2 = (await customer.request("/products?page=2")).data;
        assert.equal(page1.products.length, 9);
        assert.ok(page2.products.length);
        assert.equal(
          new Set([...page1.products, ...page2.products].map((p) => p.id)).size,
          page1.products.length + page2.products.length,
        );
        const empty = await customer.request("/products?q=no-such-product-xyz");
        assert.equal(empty.data.total, 0);
      },
    );
  },
);
