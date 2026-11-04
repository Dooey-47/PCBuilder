# Sprint 1 Browse and access

Goal: guests can explore products, customers can access and update an account, and the backend distinguishes Customer and Admin access.

## Apply this update

Copy the source files into your project, keeping your own `server/.env` and Git history. The original Category migration is unchanged; the new migration adds Sprint 1 tables without deleting existing categories.

Inside `server`, run:

```sh
npm ci
npx prisma migrate dev
npx prisma generate
npx prisma db seed
npm run dev
```

Keep your existing generated SESSION_SECRET, or generate one of at least 32 characters using the README command. Copy optional Admin settings from `.env.example` if needed. In a second terminal, run `npm ci` and `npm run dev` inside `client`.

## Acceptance checklist

- Browse six seeded products without signing in; change category and open product details.
- See VND prices, specifications, brand, warranty, and stock. The graphics card demonstrates an out-of-stock state.
- Hidden products do not appear in lists and return 404 at their detail endpoint.
- Register with a name, email, and password of 8–128 characters. New users are always Customers.
- Duplicate emails and invalid inputs return field errors; passwords never appear in API responses.
- Sign in, reload, edit your name/phone, reload again, and confirm the saved values.
- Sign out, then confirm the account page requires sign-in again.
- Customer requests to `/api/admin/overview` return 403; anonymous requests return 401.
- Create an optional demo Admin using the README instructions and open `/admin`.
- Try the pages at desktop and mobile widths and navigate controls using the keyboard.
- Stop/restart the backend and confirm an unexpired session remains valid with the same session secret.

## API routes

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/health` | Public database connectivity check |
| GET | `/api/categories` | Public |
| GET | `/api/products?page=1&category=1` | Public; category is optional, page size is 9 |
| GET | `/api/products/:id` | Public; active products only |
| GET | `/api/auth/session` | Public; returns safe account fields or null, plus a CSRF token |
| POST | `/api/auth/register` | Public; name, email, password; phone optional |
| POST | `/api/auth/login` | Public; email, password |
| POST | `/api/auth/logout` | Current session |
| PATCH | `/api/account` | Signed-in active user; name and optional phone |
| GET | `/api/admin/overview` | Signed-in active Admin only |

State-changing requests require the session cookie and `X-CSRF-Token` obtained from `/api/auth/session`. Registration/login rotate both the session and token. The frontend API helper handles this. Authenticated routes do not cache responses. Auth attempts are limited to 30 per IP per 15 minutes.

## Verification

```sh
# client/
npm run lint
npm run build

# server/ (set TEST_DATABASE_URL in .env to include integration tests)
npm test
```

Tests create a random schema and apply both committed migrations, then remove that schema. They cover catalog visibility/filtering, database constraints, CSRF, registration, duplicate emails, password hashing, profile changes, session persistence/logout, disabled accounts, authorization, and repeatable seeding. No tests use or modify public tables.

## Remaining work

This is a local Sprint 1 implementation. Deploying a shared demo environment and review by teammates remain acceptance tasks. This delivery has not been published or pushed to the remote repository.

Full search/specification filtering, cart, checkout, order history, catalog editing, and reporting belong to later sprints. Admin overview counts are a small permission demonstration, not the final reporting feature. Email changes, password reset, and email verification are not implemented.

Demo products, specifications, prices, brands, and vector illustrations are fictional. Seeding adds missing records and preserves existing edits; it does not make separate databases identical. Optional Admin seeding never promotes existing Customers or resets their passwords.

Vite's proxy is for development. Production hosting must separately route `/api` to Express, serve frontend routes through `index.html`, provide HTTPS and secrets, and configure the trusted proxy for the actual hosting environment. Login throttling currently uses one backend process's memory; sessions use PostgreSQL.
