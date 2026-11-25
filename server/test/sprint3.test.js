import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture } from "./helpers.mjs";

const enabled = {
  skip:
    !process.env.TEST_DATABASE_URL &&
    "Set TEST_DATABASE_URL to run PostgreSQL integration tests.",
};
test(
  "Sprint 3 upgrades existing orders without changing snapshots or inventory",
  enabled,
  async (t) => {
    const id = randomUUID();
    const f = await fixture(t, {
      beforeSprint3: async (client) => {
        await client.query(
          `INSERT INTO "User" ("email", "passwordHash", "name", "updatedAt") VALUES ('legacy-order@example.test','keep-hash','Legacy', NOW())`,
        );
        await client.query(
          `INSERT INTO "Order" ("id","reference","userId","recipientName","phone","address","subtotal","shippingFee","total","idempotencyKey","requestHash") VALUES ($1,'LEGACY-ORDER',(SELECT "id" FROM "User" LIMIT 1),'Original recipient','0912345678','Original delivery address',500000,30000,530000,'legacy-key','keep-hash')`,
          [id],
        );
        await client.query(`INSERT INTO "Category" ("name") VALUES ('Legacy category');
          INSERT INTO "Brand" ("name") VALUES ('Legacy brand');
          INSERT INTO "Product" ("sku","name","description","price","stock","warrantyText","categoryId","brandId","updatedAt") VALUES
          ('LEGACY-S3','Current product name','Current description',333333,7,'Existing warranty',
          (SELECT "id" FROM "Category" WHERE "name"='Legacy category'),
          (SELECT "id" FROM "Brand" WHERE "name"='Legacy brand'),NOW())`);
        await client.query(
          `INSERT INTO "OrderItem" ("orderId","productId","productName","sku","unitPrice","quantity","lineTotal") VALUES
          ($1,(SELECT "id" FROM "Product" WHERE "sku"='LEGACY-S3'),'Original purchased name','LEGACY-S3',250000,2,500000)`,
          [id],
        );
      },
    });
    const order = await f.prisma.order.findUnique({
      where: { id },
      include: { events: true, items: true },
    });
    const product = await f.prisma.product.findUnique({
      where: { sku: "LEGACY-S3" },
    });
    assert.equal(product.stock, 7);
    assert.equal(product.price.toString(), "333333");
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].productName, "Original purchased name");
    assert.equal(order.items[0].unitPrice.toString(), "250000");
    assert.equal(order.items[0].quantity, 2);
    assert.equal(order.reference, "LEGACY-ORDER");
    assert.equal(order.total.toString(), "530000");
    assert.equal(order.address, "Original delivery address");
    assert.equal(order.status, "PENDING");
    assert.equal(order.paymentStatus, "PENDING");
    assert.equal(order.version, 0);
    assert.equal(order.updatedAt.toISOString(), order.createdAt.toISOString());
    assert.equal(order.events.length, 1);
    assert.equal(order.events[0].action, "IMPORTED");
    assert.equal(order.events[0].actorRole, null);
  },
);

test(
  "Sprint 3 order lifecycle, authorization, concurrency and payment simulation",
  enabled,
  async (t) => {
    const f = await fixture(t),
      { prisma, pool } = f;
    const customer = await f.account(),
      other = await f.account(),
      admin = await f.account("ADMIN");
    const source = await prisma.product.findFirst({
      where: { active: true, stock: { gte: 10 } },
    });
    let serial = 0;
    async function place(method = "COD", count = 1, multiple = false) {
      const product = await prisma.product.create({
        data: {
          sku: `S3-${++serial}`,
          name: `Snapshot ${serial}`,
          description: "Integration test product",
          price: "100000",
          stock: 10,
          warrantyText: "12 months",
          categoryId: source.categoryId,
          brandId: source.brandId,
        },
      });
      const cart = await customer.request(`/cart/items/${product.id}`, {
        method: "PUT",
        body: { quantity: count },
      });
      assert.equal(cart.status, 200);
      let extraProduct;
      if (multiple) {
        const {
          id: _id,
          createdAt: _created,
          updatedAt: _updated,
          ...data
        } = product;
        extraProduct = await prisma.product.create({
          data: { ...data, sku: `S3-${++serial}` },
        });
        const result = await customer.request(
          `/cart/items/${extraProduct.id}`,
          { method: "PUT", body: { quantity: 2 } },
        );
        cart.data.cart = result.data.cart;
      }
      const key = randomUUID();
      const body = {
        recipientName: "Snapshot Recipient",
        phone: "0912345678",
        address: "123 Original Street, Example City",
        paymentMethod: method,
        cartToken: cart.data.cart.token,
      };
      const result = await customer.request("/orders", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body,
      });
      assert.equal(result.status, 201, JSON.stringify(result.data));
      return { order: result.data.order, product, extraProduct, key, body };
    }
    const read = async (id) =>
      (await customer.request(`/orders/${id}`)).data.order;
    const cancel = (order, who = customer) =>
      who.request(`/orders/${order.id}/cancel`, {
        method: "POST",
        body: { version: order.version },
      });
    const move = (order, status, who = admin) =>
      who.request(`/admin/orders/${order.id}/status`, {
        method: "PATCH",
        body: { version: order.version, status },
      });
    const pay = (order, outcome, who = customer) =>
      who.request(`/orders/${order.id}/simulated-payment`, {
        method: "POST",
        body: { version: order.version, outcome },
      });
    const collect = (order, who = admin) =>
      who.request(`/admin/orders/${order.id}/collect-cod`, {
        method: "POST",
        body: { version: order.version },
      });

    await t.test(
      "owner-only read/write, admin-only processing, CSRF and strict bodies",
      async () => {
        const { order } = await place();
        assert.equal((await other.request(`/orders/${order.id}`)).status, 404);
        assert.equal((await cancel(order, other)).status, 404);
        assert.equal((await pay(order, "SUCCESS", other)).status, 404);
        assert.equal((await other.request("/orders")).data.total, 0);
        assert.equal((await move(order, "CONFIRMED", customer)).status, 403);
        assert.equal((await customer.request("/admin/orders")).status, 403);
        assert.equal(
          (await customer.request(`/admin/orders/${order.id}`)).status,
          403,
        );
        assert.equal((await collect(order, customer)).status, 403);
        assert.equal((await f.browser().request("/orders")).status, 401);
        assert.equal(
          (
            await customer.request(`/orders/${order.id}/cancel`, {
              method: "POST",
              body: { version: 0 },
              csrf: false,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await customer.request(`/orders/${order.id}/cancel`, {
              method: "POST",
              body: { version: 0, total: "0" },
            })
          ).status,
          422,
        );
        assert.equal((await cancel(order)).status, 200);
      },
    );
    await t.test(
      "double/concurrent cancellation restores hidden product stock exactly once",
      async () => {
        const { order, product } = await place("COD", 3);
        await prisma.product.update({
          where: { id: product.id },
          data: {
            active: false,
            name: "New name",
            price: "222222",
            version: { increment: 1 },
          },
        });
        const outcomes = await Promise.all([
          cancel(order),
          cancel(order),
          cancel(order),
        ]);
        assert.deepEqual(
          outcomes.map((r) => r.status),
          [200, 200, 200],
        );
        const current = await read(order.id),
          item = await prisma.product.findUnique({ where: { id: product.id } });
        assert.equal(item.stock, 10);
        assert.equal(item.version, product.version + 3);
        assert.equal(item.active, false);
        assert.equal(current.version, 1);
        assert.equal(
          current.events.filter((e) => e.action === "CANCELLED").length,
          1,
        );
        assert.equal(current.items[0].productName, product.name);
        assert.equal(current.items[0].unitPrice, "100000");
        assert.equal(current.address, "123 Original Street, Example City");
        assert.equal((await move(current, "CONFIRMED")).status, 409);
      },
    );
    await t.test(
      "cancel versus confirmation has one winner and consistent inventory",
      async () => {
        for (let i = 0; i < 4; i++) {
          const { order, product } = await place("COD", 2);
          const outcomes = await Promise.all([
            cancel(order),
            move(order, "CONFIRMED"),
          ]);
          assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
          const current = await read(order.id),
            item = await prisma.product.findUnique({
              where: { id: product.id },
            });
          assert.equal(item.stock, current.status === "CANCELLED" ? 10 : 8);
          assert.equal(current.events.length, 2);
          assert.equal(current.version, 1);
        }
      },
    );
    await t.test(
      "forward transitions only; stale admin tabs fail; COD collection is explicit",
      async () => {
        let { order } = await place();
        assert.equal((await move(order, "SHIPPING")).status, 409);
        assert.equal((await collect(order)).status, 409);
        const original = order;
        order = (await move(order, "CONFIRMED")).data.order;
        assert.equal((await move(original, "SHIPPING")).status, 409);
        assert.equal((await cancel(order)).status, 409);
        assert.equal((await move(order, "PENDING")).status, 409);
        const outcomes = await Promise.all([
          move(order, "SHIPPING"),
          move(order, "SHIPPING"),
        ]);
        assert.deepEqual(
          outcomes.map((r) => r.status),
          [200, 200],
        );
        order = await read(order.id);
        assert.equal(
          order.events.filter((e) => e.action === "SHIPPING").length,
          1,
        );
        assert.equal((await collect(order)).status, 409);
        order = (await move(order, "DELIVERED")).data.order;
        assert.equal(order.paymentStatus, "PENDING");
        assert.equal((await cancel(order)).status, 409);
        assert.equal((await move(order, "SHIPPING")).status, 409);
        const paid = await Promise.all([collect(order), collect(order)]);
        assert.deepEqual(
          paid.map((r) => r.status),
          [200, 200],
        );
        order = await read(order.id);
        assert.equal(order.paymentStatus, "PAID");
        assert.equal(
          order.events.filter((e) => e.action === "COD_COLLECTED").length,
          1,
        );
        assert.equal((await pay(order, "SUCCESS")).status, 409);
      },
    );
    await t.test(
      "failed simulation reserves stock, supports retry, blocks fulfillment until paid",
      async () => {
        let { order, product } = await place("SIMULATED", 2);
        assert.equal((await move(order, "CONFIRMED")).status, 409);
        assert.equal((await pay(order, "FAILURE")).status, 200);
        order = await read(order.id);
        assert.equal(order.paymentStatus, "FAILED");
        assert.equal(order.status, "PENDING");
        assert.equal(
          (await prisma.product.findUnique({ where: { id: product.id } }))
            .stock,
          8,
        );
        assert.equal((await move(order, "CONFIRMED")).status, 409);
        assert.equal((await pay(order, "FAILURE")).status, 200);
        const paid = await pay(order, "SUCCESS");
        assert.equal(paid.status, 200);
        order = paid.data.order;
        assert.equal(order.paymentStatus, "PAID");
        assert.equal((await pay(order, "FAILURE")).status, 409);
        assert.equal((await pay(order, "SUCCESS")).status, 200);
        assert.equal((await collect(order)).status, 409);
        order = (await move(order, "CONFIRMED")).data.order;
        order = (await move(order, "SHIPPING")).data.order;
        order = (await move(order, "DELIVERED")).data.order;
        assert.equal(order.paymentStatus, "PAID");
        assert.equal((await cancel(order)).status, 409);
        assert.equal(
          (await prisma.product.findUnique({ where: { id: product.id } }))
            .stock,
          8,
        );
        assert.equal(
          order.events.filter((e) => e.action === "SIMULATED_PAID").length,
          1,
        );
        assert.equal(
          order.events.filter((e) => e.action === "SIMULATED_FAILED").length,
          1,
        );
      },
    );
    await t.test(
      "cancelling paid Pending simulation refunds demo payment and restocks once",
      async () => {
        let { order, product } = await place("SIMULATED", 2);
        order = (await pay(order, "SUCCESS")).data.order;
        order = (await move(order, "CANCELLED")).data.order;
        assert.equal(order.status, "CANCELLED");
        assert.equal(order.paymentStatus, "REFUNDED");
        assert.equal((await cancel(order)).status, 200);
        assert.equal((await pay(order, "SUCCESS")).status, 409);
        assert.equal(
          (await prisma.product.findUnique({ where: { id: product.id } }))
            .stock,
          10,
        );
        assert.equal(order.events.at(-1).actorRole, "ADMIN");
      },
    );
    await t.test(
      "unpaid/failed simulation cancellation releases its reservation",
      async () => {
        for (const failed of [false, true]) {
          let { order, product } = await place("SIMULATED");
          if (failed) order = (await pay(order, "FAILURE")).data.order;
          const result = await cancel(order);
          assert.equal(result.status, 200);
          assert.equal(
            result.data.order.paymentStatus,
            failed ? "FAILED" : "PENDING",
          );
          assert.equal(
            (await prisma.product.findUnique({ where: { id: product.id } }))
              .stock,
            10,
          );
        }
      },
    );
    await t.test(
      "competing payment outcomes cannot regress a successful payment",
      async () => {
        let { order } = await place("SIMULATED");
        const results = await Promise.all([
          pay(order, "SUCCESS"),
          pay(order, "FAILURE"),
        ]);
        assert.equal(results.filter((r) => r.status === 200).length, 1);
        order = await read(order.id);
        if (order.paymentStatus === "FAILED")
          order = (await pay(order, "SUCCESS")).data.order;
        assert.equal(order.paymentStatus, "PAID");
        assert.equal((await pay(order, "FAILURE")).status, 409);
      },
    );
    await t.test(
      "payment versus cancellation produces no paid cancelled order",
      async () => {
        const { order, product } = await place("SIMULATED");
        const results = await Promise.all([
          pay(order, "SUCCESS"),
          cancel(order),
        ]);
        assert.equal(results.filter((r) => r.status === 200).length, 1);
        let current = await read(order.id);
        if (current.status === "PENDING")
          current = (await cancel(current)).data.order;
        assert.equal(current.status, "CANCELLED");
        assert.ok(["PENDING", "REFUNDED"].includes(current.paymentStatus));
        assert.equal(
          (await prisma.product.findUnique({ where: { id: product.id } }))
            .stock,
          10,
        );
      },
    );
    await t.test(
      "cancellation rollback includes order, history and every product",
      async () => {
        const { order, product, extraProduct } = await place("COD", 1, true);
        const extraBefore = await prisma.product.findUnique({
          where: { id: extraProduct.id },
        });
        const before = await prisma.product.findUnique({
          where: { id: product.id },
        });
        await pool.query(
          `CREATE FUNCTION reject_cancel() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."status" = 'CANCELLED' THEN RAISE EXCEPTION 'Forced rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_cancel BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION reject_cancel();`,
        );
        try {
          assert.equal((await cancel(order)).status, 503);
        } finally {
          await pool.query(
            'DROP TRIGGER reject_cancel ON "Order"; DROP FUNCTION reject_cancel()',
          );
        }
        const after = await prisma.product.findUnique({
            where: { id: product.id },
          }),
          current = await read(order.id);
        const extraAfter = await prisma.product.findUnique({
          where: { id: extraProduct.id },
        });
        assert.equal(extraAfter.stock, extraBefore.stock);
        assert.equal(extraAfter.version, extraBefore.version);
        assert.equal(after.stock, before.stock);
        assert.equal(after.version, before.version);
        assert.equal(current.status, "PENDING");
        assert.equal(current.version, 0);
        assert.equal(current.events.length, 1);
        assert.equal((await cancel(order)).status, 200);
      },
    );
    await t.test(
      "inventory overflow aborts cancellation without partially restoring stock",
      async () => {
        const { order, product, extraProduct } = await place("COD", 2, true);
        await prisma.product.update({
          where: { id: extraProduct.id },
          data: { stock: 2147483647 },
        });
        assert.equal((await cancel(order)).status, 409);
        assert.equal(
          (await prisma.product.findUnique({ where: { id: product.id } }))
            .stock,
          8,
        );
        const current = await read(order.id);
        assert.equal(current.status, "PENDING");
        assert.equal(current.events.length, 1);
      },
    );
    await t.test(
      "checkout key replay returns current order after later actions",
      async () => {
        const { order, key, body } = await place();
        await cancel(order);
        const result = await customer.request("/orders", {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body,
        });
        assert.equal(result.status, 200);
        assert.equal(result.data.replayed, true);
        assert.equal(result.data.order.status, "CANCELLED");
        assert.equal(result.data.order.requestHash, undefined);
        assert.equal(result.data.order.userId, undefined);
      },
    );
    await t.test(
      "list filters, pagination, safe data exposure and invalid dates",
      async () => {
        const { order } = await place();
        const result = await admin.request(
          `/admin/orders?q=${order.reference}&status=PENDING&paymentMethod=COD&paymentStatus=PENDING&after=2000-01-01&before=2099-12-31`,
        );
        assert.equal(result.status, 200);
        assert.equal(result.data.total, 1);
        assert.equal(result.data.orders[0].id, order.id);
        assert.equal(result.data.orders[0].user.email, customer.user.email);
        const byEmail = await admin.request(
          `/admin/orders?q=${encodeURIComponent(customer.user.email)}`,
        );
        assert.ok(byEmail.data.total > 10);
        assert.equal(byEmail.data.orders.length, 10);
        const second = await admin.request(
          `/admin/orders?page=2&q=${encodeURIComponent(customer.user.email)}`,
        );
        assert.ok(second.data.orders.length > 0);
        assert.notEqual(second.data.orders[0].id, byEmail.data.orders[0].id);
        const own = await customer.request(`/orders?q=${order.reference}`);
        assert.equal(own.data.total, 1);
        assert.equal(own.data.orders[0].user, undefined);
        for (const path of [
          "?after=2026-02-30",
          "?after=2026-11-25&before=2025-01-01",
          "?status=BOGUS",
          "?page=0",
          "?paymentStatus=BOGUS",
        ])
          assert.equal(
            (await admin.request(`/admin/orders${path}`)).status,
            422,
          );
        const detail = await admin.request(`/admin/orders/${order.id}`);
        assert.equal(detail.data.order.user.passwordHash, undefined);
        assert.equal(detail.data.order.requestHash, undefined);
        await prisma.user.update({
          where: { id: other.user.id },
          data: { active: false },
        });
        assert.equal((await other.request("/orders")).status, 401);
      },
    );
  },
);
