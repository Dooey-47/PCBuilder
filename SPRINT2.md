# Sprint 2 Find and complete a basic purchase

This update follows FR-02, FR-03 and FR-06 in the original Sprint 2 plan, plus the minimal COD purchase flow moved forward in our revised plan. The stack remains JavaScript, React/Vite, Express, PostgreSQL and Prisma 7.

## Apply the changed files

The download contains only new or changed files relative to the corrected Sprint 1 delivery. Copy its contents into the project root, preserving paths. Keep your real `server/.env`, existing migrations, database, images and Git history. If you edited the same source files locally, merge those edits rather than overwriting them blindly.

Stop the backend while applying the schema update. In `server` run:

```sh
npm ci
npx prisma migrate dev
npx prisma generate
npx prisma db seed
npm run dev
```

In a second terminal, inside `client`:

```sh
npm ci
npm run dev
```

No reset is needed. The new migration adds cart/order tables and version/use-case fields, preserves existing stock/accounts/products, and tags only the original demo SKUs. Old migration files are unchanged. Seeding continues to preserve edits to existing products and Admin passwords.

Optional configuration in your local `server/.env`:

```dotenv
SHIPPING_FEE_VND=30000
```

The default is a flat 30,000 VND delivery fee per nonempty cart. Set a nonnegative whole VND amount, including 0 for free delivery. A changed fee requires the customer to review checkout again. Existing SESSION_SECRET and optional DEMO_ADMIN settings still work.

## Features and acceptance walkthrough

1. Browse without signing in. Combine keyword, category, brand, min/max price, availability, use case and specification filters. Change sort order; clear filters to recover empty results. Pagination is 9 products per page. Mobile filters open from the Search & filters control.
2. Sign in as a Customer. Add a product; verify the header quantity. Open `/cart`, set an absolute quantity, remove an item, reload and verify persistence. Invalid quantities or quantities exceeding stock are rejected. A cart does not reserve inventory.
3. As Admin, open `/admin/products`. Add/edit a product, assign category/brand/use cases, provide warranty, specifications and image URLs. Update stock. Hide/publish products. Manage categories and brands; deletion is rejected while referenced by products.
4. Upload PNG, JPEG or WebP images using the Admin editor (one file at a time, max 2 MB; up to 8 images per product). File type is checked using its signature and MIME type. SVG uploads are rejected; existing demo SVG paths remain supported.
5. Save a product from two editor tabs: the second stale edit must return 409 and ask for a reload. A stock change made by checkout also invalidates an old editor version.
6. Checkout with recipient name, phone, full address and COD. Review server-calculated totals. Success shows an order reference, stored delivery details, product/price snapshots and Pending order/payment statuses. Stock decreases and the purchased cart clears atomically.
7. Change stock/price after opening checkout. Confirmation must return 409; review the refreshed cart before trying again. A hidden/unavailable product blocks checkout.
8. If a checkout response is lost, use Retry this checkout. The pending body/key is kept in this browser tab's sessionStorage, including after reload; retry retrieves the same order instead of creating another. Delivery details are removed from that storage after confirmed success. Keep retrying an unknown outcome rather than starting a new request with a new key.
9. Open `/orders` and an order receipt. Customers can read only their own orders; another account gets 404 for the same receipt ID.

## File map

| File | Responsibility |
| --- | --- |
| `server/src/app.js` | Common validation/session/CSRF middleware, auth routes, module registration and error responses |
| `server/src/catalog.js` | Public search, filters, specification facets, brands, categories and product detail |
| `server/src/admin-catalog.js` | Admin catalog CRUD, metadata CRUD, upload validation and public upload delivery |
| `server/src/commerce.js` | Cart persistence, quotes, stock locking, COD checkout, owned order reads |
| `server/src/http-errors.js` | Shared request validation and HTTP errors |
| `server/prisma/schema.prisma` | Cart, orders, purchase snapshots and relationships |
| `client/src/Catalog.jsx` | Catalog, category/use-case navigation, filters, sorting and product cards |
| `client/src/CartProvider.jsx`, `shop-context.js` | Shared cart state and header quantity |
| `client/src/ShopPages.jsx` | Cart, checkout/recovery, receipts and minimal order list |
| `client/src/AdminCatalog.jsx` | Product editor, metadata management and image uploads |
| `client/src/api.js` | JSON/FormData requests, CSRF and checkout idempotency headers |
| `client/src/useRemote.js`, `shop-ui.jsx`, `format.js` | Loading/error handling, shared shop UI and exact integer VND display |

## API additions and changes

All paths below have the `/api` prefix. Writes require the session cookie and CSRF header handled by `api.js`.

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/products` | q, category, brand, min_price, max_price, in_stock=true, use_case, sort, page, spec |
| GET | `/brands` | Public brand list |
| GET | `/catalog-filters?category=1` | Specification options for active products; category optional |
| GET | `/cart` | Own items, availability, exact totals and an opaque quote token |
| PUT | `/cart/items/:productId` | `{quantity: 2}` sets an absolute integer quantity, 1–999 |
| DELETE | `/cart/items/:productId` | Remove own cart line |
| POST | `/orders` | Delivery fields, paymentMethod="COD", cartToken, and UUID `Idempotency-Key` header |
| GET | `/orders?page=1` | Own order list (10 per page) |
| GET | `/orders/:id` | Own receipt with purchase snapshots |
| GET/POST | `/admin/products` | List all products including hidden ones / create product |
| GET/PATCH/DELETE | `/admin/products/:id` | Read/edit/hide product; edits/hiding require its current version |
| POST | `/admin/categories`, `/admin/brands` | Create metadata with `{name}` |
| PATCH/DELETE | `/admin/categories/:id`, `/admin/brands/:id` | Rename/delete unused metadata |
| POST | `/admin/uploads` | multipart/form-data, field `image`; returns an image URL |
| GET | `/uploads/:filename` | Public image file delivery |

`sort`: featured, price_asc, price_desc, name, newest. `spec` is a URL-encoded JSON object, for example `{"Memory":"16 GB","Storage":"512 GB SSD"}` (up to 8 pairs). Common name/unit aliases are normalized on Admin writes and filter input. Prices, shipping and totals use whole VND; the backend uses decimal storage and integer arithmetic, and rejects client-supplied totals.

## Transaction and concurrency rules

Cart writes and checkout lock the current customer's User row. Checkout then locks product rows in ascending ID order, rereads current prices/stock, compares the latest quote, conditionally deducts stock, creates the order/items and clears the cart in one transaction. Any failure rolls everything back.

The database enforces a unique `(userId, idempotencyKey)`. Reusing a key with the same normalized request returns the existing order (200 rather than 201); reusing it with different details returns 409. Product edits also require a current version so a stale stock form cannot overwrite a sale. Order snapshots do not change when a product or profile is edited.

## Images and team development

New uploads are stored in `server/uploads/`, served through `/api/uploads/`, and excluded from Git. Keep that folder when restarting/updating a local server. Like local database records, these files do not synchronize across teammates. For a shared hosted environment, use durable shared storage or HTTPS image URLs from an external object-storage service. No cloud account or external upload integration was added.

Existing seeded illustrations remain in `client/public/images/`. Image files stay outside PostgreSQL; ProductImage stores their URLs.

## Checks

In `client`: `npm test`, `npm run lint`, `npm run build`.

In `server`: set `TEST_DATABASE_URL` in `.env`, then run `npm test`. Database integration checks use isolated temporary schemas and remove only those schemas. The database user must be allowed to create schemas. The tests cover Sprint 1 regression behavior plus combined filtering, permissions, uploads, cart ownership/validation, stale edits, changed quotes, same/different-key checkout races, last-unit races, order privacy and forced rollback.

## Sprint 3 and later

This is the revised Sprint 2 COD flow. Payment simulation, cancellation and stock restoration, fulfillment transitions, customer account administration, revenue/bestseller reporting, promotions and PC compatibility tools are not implemented here. The new order list/receipt is minimal purchase confirmation, not full order lifecycle management. Publishing the shared demo and reviewing it with teammates remain separate acceptance tasks.
