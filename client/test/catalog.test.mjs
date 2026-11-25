import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

test("catalog renders its initial loading state before product data exists", async () => {
  const vite = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    appType: "custom",
  });
  try {
    const { default: App } = await vite.ssrLoadModule("/src/App.jsx");
    const { AuthContext } = await vite.ssrLoadModule("/src/auth-context.js");
    const markup = renderToString(
      createElement(
        MemoryRouter,
        { initialEntries: ["/"] },
        createElement(
          AuthContext.Provider,
          {
            value: { user: null, loading: true, error: "", setUser() {} },
          },
          createElement(App),
        ),
      ),
    );
    assert.match(markup, /Loading products/);
    assert.match(markup, /Explore the collection/);
    assert.doesNotMatch(markup, /pagination-row/);
  } finally {
    await vite.close();
  }
});
