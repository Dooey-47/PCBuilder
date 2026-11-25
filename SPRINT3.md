# Sprint 3 — order processing and simulated payment

This continues the revised Sprint 2 delivery. It completes the local FR-04/FR-05 purchase lifecycle: payment choice, owned order history/details, Pending cancellation and Admin fulfillment. JavaScript, React/Vite/Bootstrap, Express, PostgreSQL and Prisma **7.10.1** remain unchanged.

## Apply this update

1. Stop the backend and frontend. Extract the changed-file ZIP into the existing project root, preserving `client/` and `server/` paths. Merge any edits you made to the same files. The ZIP is relative to the Sprint 2 delivery; apply Sprint 2 first if needed.
2. From the project root:

   ```sh
   cd server
   npx prisma migrate deploy
   npx prisma generate
   npm run dev
   ```

3. In a separate terminal from the project root:

   ```sh
   cd client
   npm run dev
   ```

No new npm dependencies, environment variables, seed run, or database reset are required. Keep your local `.env`, uploads, old migration files and existing Admin credentials. Do not replace earlier migration SQL or run `prisma migrate reset` to apply this update.

The additive migration adds `SIMULATED`, `REFUNDED`, order versions/timestamps and activity records. Existing orders/items, addresses, totals, accounts and inventory are preserved. An imported order gets one explicitly labelled snapshot event; the migration does not invent its earlier transition history. For future schema edits, continue creating a new named migration with `prisma migrate dev --name ...` and commit it.

## Business rules

| Area | Implemented behavior |
| --- | --- |
| Fulfillment | Pending → Confirmed → Shipping → Delivered. Only Pending → Cancelled is allowed. No skipping, reversal or reopening. |
| Cancellation | Customer may cancel an owned Pending order; Admin may cancel a Pending order from its detail screen. Stock restoration, product version increments, order status and activity commit together. Repeated cancellation does not restock again. Hidden products are restored too. |
| COD | Checkout starts with payment Pending. Fulfillment does not automatically mark it Paid. After delivery, Admin explicitly confirms receipt of the full COD amount. Customers cannot record collection. |
| Simulation | Checkout reserves inventory and creates a Pending order/payment. Its owner chooses demo success or failure on the receipt. Failure leaves the order Pending and inventory reserved; retry or cancel. Confirmation is blocked until payment succeeds. No real gateway, card data or money is involved. |
| Paid Pending cancellation | A cancelled, paid simulated order becomes payment Refunded in the same transaction. This is a demo refund only. Cancellation before payment leaves its last payment state Pending/Failed. |
| Delivered orders | Cannot be cancelled/refunded through this sprint's endpoints. No automatic restocking of delivered orders. Returns and real refunds remain outside scope. |
| History | Prices, names, SKUs, delivery address and totals remain purchase snapshots. Activity records show fulfillment/payment changes, timestamps and actor role without exposing credentials. |
| Refresh | Use Refresh details/orders to see changes made elsewhere. Stale mutations get 409 and reload current details. There is no background polling or realtime push. |

Pending reservations have no automatic expiry in this exercise. Cancel unused demo orders to release stock. A failed simulation does not create another order or deduct stock again.

## Try it

1. **Customer payment failure/retry:** add an in-stock item, checkout with Simulated payment, then choose Simulate failed payment. Verify Failed payment + Pending order and unchanged reserved stock. Choose Simulate successful payment; verify Paid and a new activity entry.
2. **Refund/cancel:** while the paid simulated order is still Pending, choose Cancel order and confirm. Verify Cancelled + Refunded, stock restored and no further payment controls. Refresh/repeat the request: stock must not increase again.
3. **COD:** checkout using COD. As your existing Admin, open **Admin → Manage orders**, open its reference, Confirm order → Mark as shipping → Mark as delivered. Payment stays Pending. Choose Record COD collection and explicitly confirm receipt; payment becomes Paid.
4. **Stale tab:** leave a customer Pending receipt open. Confirm it as Admin in another browser/session. Try cancelling from the old customer tab. It must show a conflict and load Confirmed, with no restoration.
5. **Privacy:** a different Customer cannot read/cancel/pay that order by ID, or use Admin order endpoints. UI guards supplement backend checks.
6. **History/queue:** filter by order status, payment status/method and inclusive UTC creation-date range. Customer search uses order reference; Admin can also search recipient and customer email. Filters remain in the URL; pagination uses 10 rows. Open a result and verify original delivery/item/total snapshots.
7. **Recovery:** refresh after a lost payment/status/cancellation response. Repeated identical terminal actions cannot duplicate stock or activity changes. A lost checkout response still uses Sprint 2's Retry this checkout with the same body/key, even after reload.

## File map and data flow

| File | Responsibility |
| --- | --- |
| `client/src/ShopPages.jsx` | Existing cart and checkout/recovery; checkout now submits the selected COD/SIMULATED method. |
| `client/src/OrderPages.jsx` | Customer/Admin order lists, filters, detail, progress/activity, payment simulation, cancellation and processing controls. |
| `client/src/App.jsx` | Routes, Admin queue link and permission-protected screens. |
| `client/src/api.js` (unchanged) | Sends same-origin JSON requests with session cookies and CSRF headers; returns data/errors to the page. |
| `server/src/app.js` | Sessions, authentication/CSRF/error middleware and route-module registration. |
| `server/src/commerce.js` | Existing validated cart, quote and idempotent checkout; now accepts either payment method and records placement. |
| `server/src/order-management.js` | Owned reads, Admin filtering, transition/payment validation, order locks, atomic cancellation and activity writes. |
| `server/src/order-data.js` | Explicit safe order/item/event response selection shared by checkout and management. |
| `server/prisma/schema.prisma`, new migration | Additive database change; earlier migrations are unchanged. |

Checkout: **ShopPages.jsx → api.js → app.js → commerce.js → Prisma/PostgreSQL**. The response refreshes the cart and navigates to the receipt.

Order actions: **OrderPages.jsx → api.js → app.js → order-management.js → Prisma/PostgreSQL**. The page reloads the saved details, including after an uncertain response. Backend checks ownership/role and current state; FE never supplies trusted totals or stock adjustments.

## API contracts

All paths have the `/api` prefix. Writes require the existing session cookie and `X-CSRF-Token`. For a mutation, read `order.version` from the latest detail response. Invalid input is 422; a conflicting state/version is 409; inaccessible customer order IDs are 404; Admin-only access is 403.

| Method | Path | Body / purpose |
| --- | --- | --- |
| POST | `/orders` | Existing shipping + `cartToken`, with `paymentMethod: "COD"` or `"SIMULATED"`; unchanged UUID `Idempotency-Key` header. |
| GET | `/orders` | Owned orders; filters and pagination below. |
| GET | `/orders/:id` | Owned receipt including `version`, `updatedAt`, items and events. |
| POST | `/orders/:id/cancel` | `{ "version": 0 }`; Pending only. Already cancelled returns current receipt without another write. |
| POST | `/orders/:id/simulated-payment` | `{ "version": 0, "outcome": "SUCCESS" }` or `"FAILURE"`; owned Pending simulated order only. Success cannot regress to failure. |
| GET | `/admin/orders` | All orders, safe customer summary, filters and pagination. |
| GET | `/admin/orders/:id` | Order detail plus safe customer identity; no password/hash/session fields. |
| PATCH | `/admin/orders/:id/status` | `{ "version": 0, "status": "CONFIRMED" }`; forward transition or Pending cancellation. |
| POST | `/admin/orders/:id/collect-cod` | `{ "version": 3 }`; delivered COD only. Repeated collection does not duplicate activity. |

List query parameters: `page`, `q`, `status`, `paymentStatus`, `paymentMethod`, `after=YYYY-MM-DD`, `before=YYYY-MM-DD`. Dates use inclusive UTC calendar days. Unknown filters/invalid dates are rejected. Lists return `{ orders, total, page, pageSize: 10 }`; detail/mutations return `{ order }`. Checkout retains `{ order, replayed }` and its 201/200 behavior. Mutation bodies are strict and do not accept prices, totals, customer IDs or inventory changes.

## Transactions and retries

All order mutations lock the order row using `SELECT ... FOR UPDATE`. Cancellation additionally locks product rows by ascending ID, restores quantities and increments product versions so stale Admin inventory edits cannot overwrite the restoration. It never takes a User row lock; this avoids a lock cycle with checkout's User → Product order. All writes use the transaction's Prisma client; any failure rolls back order, stock, versions and activity together.

A version check rejects a conflicting action from an outdated screen. Repeating an action whose target state is already current returns the saved order without writing another event; it cannot repeat stock restoration or COD collection. Following a lost response, refresh to determine the outcome before another action. Checkout still relies on its unique customer/idempotency key and request hash, including when replaying an order that has since been cancelled or processed.

## Verification

From `server`: set `TEST_DATABASE_URL` to a PostgreSQL test database whose user can create schemas, then run `npm test`. Tests create/drop isolated random schemas. From `client`: `npm test`, `npm run lint`, `npm run build`.

Verified on the delivered source:

- **47 backend tests** passed on real PostgreSQL 17, including Sprint 1/2 regression coverage; populated Sprint 2 upgrade with item/address/price/stock preservation; ownership/roles/CSRF; strict inputs; repeated cancellation; cancellation vs confirmation; stale Admin versions; concurrent payment outcomes; payment vs cancellation; explicit COD collection; simulated retries/refunds; multi-item rollback and stock-overflow rollback; filtering/pagination; checkout replay after cancellation.
- **10 frontend tests**, ESLint and production build passed.
- Fresh `prisma migrate deploy` applied all four migrations. Prisma migration/schema comparison reported **no difference**.
- Headless Chromium, desktop 1365×1000 and mobile 390×844: actual sign-in, checkout method selection, failed/successful simulation, deliberately lost payment response, customer/Admin cancellation, stale-customer conflict, complete COD fulfillment/collection, filtered histories and Admin queue/detail. No uncaught page errors or horizontal page overflow on checked screens. Mobile tables scroll inside their containers.

## Remaining acceptance and scope

Local implementation and verification are complete. The technical document's Definition of Done also requires review/integration and a demonstration on a shared environment: deployment and teammate acceptance remain pending. This delivery does not publish the application or change shared infrastructure. Each teammate's local database/uploads remain independent.

Sprint 4 account administration and reporting, real payment integration, returns, promotions and compatibility tools remain outside this update. The new Refunded simulation state must be excluded from any future paid-revenue calculation.
