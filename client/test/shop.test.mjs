import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

test("shop pages handle loading, unavailable items and checkout recovery", async (t) => {
  const vite = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    appType: "custom",
  });
  try {
    const { default: App } = await vite.ssrLoadModule("/src/App.jsx");
    const { AuthContext } = await vite.ssrLoadModule("/src/auth-context.js");
    const { ShopContext } = await vite.ssrLoadModule("/src/shop-context.js");
    const user = {
      id: 42,
      name: "Test Learner",
      email: "learner@example.test",
      phone: "+84 912 345 678",
      role: "CUSTOMER",
    };
    const emptyCart = {
      items: [],
      quantity: 0,
      subtotal: "0",
      shippingFee: "0",
      total: "0",
      token: "a".repeat(64),
      canCheckout: false,
    };
    function render(path, shop = {}) {
      return renderToString(
        createElement(
          MemoryRouter,
          { initialEntries: [path] },
          createElement(
            AuthContext.Provider,
            { value: { user, loading: false, error: "", setUser() {} } },
            createElement(
              ShopContext.Provider,
              {
                value: {
                  loading: false,
                  pending: false,
                  refresh() {},
                  mutate() {},
                  ...shop,
                },
              },
              createElement(App),
            ),
          ),
        ),
      );
    }
    await t.test("product detail renders safely before data arrives", () =>
      assert.match(render("/products/1"), /Loading product/),
    );
    await t.test("cart renders safely while the quote loads", () =>
      assert.match(render("/cart", { loading: true }), /Loading your cart/),
    );
    await t.test("empty cart offers browsing instead of checkout", () => {
      const html = render("/cart", { cart: emptyCart });
      assert.match(html, /Your cart is empty/);
      assert.doesNotMatch(html, /Continue to checkout/);
    });
    await t.test("unavailable cart items require review", () => {
      const cart = {
        ...emptyCart,
        quantity: 2,
        items: [
          {
            productId: 1,
            name: "Unavailable laptop",
            quantity: 2,
            unitPrice: "100000",
            lineTotal: "200000",
            stock: 1,
            active: true,
            available: false,
          },
        ],
      };
      const html = render("/cart", { cart });
      assert.match(html, /reduce the quantity/);
      assert.doesNotMatch(html, /Continue to checkout/);
    });
    await t.test(
      "checkout presents required delivery fields and quoted totals",
      () => {
        const cart = {
          ...emptyCart,
          quantity: 1,
          subtotal: "100000",
          shippingFee: "30000",
          total: "130000",
          canCheckout: true,
          items: [
            { productId: 1, name: "Laptop", quantity: 1, lineTotal: "100000" },
          ],
        };
        const html = render("/checkout", { cart });
        assert.match(html, /Recipient name/);
        assert.match(html, /Full delivery address/);
        assert.match(html, /130\.000/);
        assert.match(html, /Confirm COD order/);
        assert.match(html, /Simulated payment/);
      },
    );
    await t.test(
      "customer order list and detail render safely while loading",
      () => {
        assert.match(render("/orders"), /Loading orders/);
        assert.match(render("/orders/example-order"), /Loading order/);
      },
    );
    await t.test(
      "customers cannot render administrator order processing",
      () => {
        const html = render("/admin/orders");
        assert.doesNotMatch(html, /Manage orders/);
        assert.doesNotMatch(html, /Confirm order/);
      },
    );
    await t.test(
      "unknown checkout can recover after reload even when the cart is empty",
      () => {
        const descriptor = Object.getOwnPropertyDescriptor(
          globalThis,
          "sessionStorage",
        );
        Object.defineProperty(globalThis, "sessionStorage", {
          configurable: true,
          value: {
            getItem: () =>
              JSON.stringify({
                key: "attempt-key",
                body: { cartToken: emptyCart.token },
              }),
          },
        });
        try {
          const html = render("/checkout", { cart: emptyCart });
          assert.match(html, /Retry this checkout/);
          assert.match(html, /cart may have been cleared/);
          assert.doesNotMatch(html, /Confirm COD order/);
        } finally {
          if (descriptor)
            Object.defineProperty(globalThis, "sessionStorage", descriptor);
          else delete globalThis.sessionStorage;
        }
      },
    );
  } finally {
    await vite.close();
  }
});
