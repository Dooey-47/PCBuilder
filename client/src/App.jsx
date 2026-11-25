import { useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { api } from "./api.js";
import { useAuth } from "./auth-context.js";
import { useShop } from "./shop-context.js";
import useRemote from "./useRemote.js";
import { money } from "./format.js";
import Catalog from "./Catalog.jsx";
import { AddToCart } from "./shop-ui.jsx";
import { CartPage, CheckoutPage } from "./ShopPages.jsx";
import { OrderReceipt, OrdersPage } from "./OrderPages.jsx";
import AdminCatalog from "./AdminCatalog.jsx";

function Message({ children, error = false }) {
  return (
    <div
      className={`notice ${error ? "notice-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

function Layout() {
  const { user, loading, error, setUser } = useAuth();
  const { cart } = useShop() ?? {};
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const navigate = useNavigate();
  async function logout() {
    setSigningOut(true);
    setLogoutError("");
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      navigate("/");
    } catch (err) {
      setLogoutError(err.message);
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="announcement">
        A little more clarity. A better next build.
      </div>
      <header className="site-header">
        <div className="shell header-inner">
          <Link to="/" className="brand" aria-label="PCBuilder home">
            <span className="brand-mark">
              p<span>c</span>
            </span>
            <span>
              PCBuilder<span className="brand-dot">.</span>
            </span>
          </Link>
          <nav className="header-nav" aria-label="Main navigation">
            <NavLink to="/" end>
              Explore products
            </NavLink>
            {user && (
              <>
                <NavLink to="/cart">Cart ({cart?.quantity ?? 0})</NavLink>
                <NavLink to="/orders">My orders</NavLink>
              </>
            )}
            {user?.role === "ADMIN" && <NavLink to="/admin">Admin</NavLink>}
          </nav>
          <div className="account-nav">
            {loading ? (
              <span className="muted">Connecting…</span>
            ) : user ? (
              <>
                <Link className="account-link" to="/account">
                  <span className="avatar">
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="account-name">{user.name}</span>
                </Link>
                <button
                  className="text-button"
                  onClick={logout}
                  disabled={signingOut}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            ) : (
              <>
                <Link className="text-button" to="/login">
                  Sign in
                </Link>
                <Link className="button button-small" to="/register">
                  Create account <span aria-hidden="true">↗</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      {(error || logoutError) && (
        <div className="shell">
          <Message error>{logoutError || `Account service: ${error}`}</Message>
        </div>
      )}
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="shell footer-inner">
          <Link to="/" className="footer-brand">
            PCBuilder.
          </Link>
          <p>Thoughtful tech. Clear choices.</p>
          <span>Student project · Demo catalog</span>
        </div>
      </footer>
    </>
  );
}

function Stock({ stock }) {
  return (
    <span className={`stock ${stock ? "" : "stock-empty"}`}>
      <span aria-hidden="true">●</span>{" "}
      {stock ? `${stock} in stock` : "Out of stock"}
    </span>
  );
}

function ProductDetail() {
  const { id } = useParams();
  const { data, error, loading } = useRemote(`/products/${id}`);
  const [imageIndex, setImageIndex] = useState(0);
  if (loading)
    return (
      <div className="shell page-section">
        <Message>Loading product…</Message>
      </div>
    );
  if (error)
    return (
      <div className="shell page-section">
        <Message error>{error.message}</Message>
        <Link to="/">Back to products</Link>
      </div>
    );
  const { product } = data;
  const image = product.images[imageIndex] ?? product.images[0];
  return (
    <div className="shell page-section">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Products</Link>
        <span aria-hidden="true">/</span>
        <span>{product.name}</span>
      </nav>
      <div className="detail-grid">
        <div>
          <div className="detail-image">
            {image && (
              <img src={image.url} alt={image.alt} width="480" height="360" />
            )}
          </div>
          {product.images.length > 1 && (
            <div className="image-choices">
              {product.images.map((item, index) => (
                <button
                  key={item.id}
                  aria-label={`View product image ${index + 1}`}
                  aria-pressed={index === imageIndex}
                  onClick={() => setImageIndex(index)}
                >
                  <img src={item.url} alt="" width="80" height="60" />
                </button>
              ))}
            </div>
          )}
        </div>
        <section className="detail-copy">
          <p className="eyebrow">
            {product.brand.name} · {product.category.name}
          </p>
          <h1>{product.name}</h1>
          <p className="detail-description">{product.description}</p>
          <strong className="detail-price">{money(product.price)}</strong>
          <Stock stock={product.stock} />
          <p className="warranty">
            <span aria-hidden="true">✓</span> {product.warrantyText}
          </p>
          <AddToCart product={product} />
          <div className="detail-next">
            <strong>Ready for your next setup?</strong>
            <p>
              Add it to your cart, then review delivery details and pay cash on
              delivery.
            </p>
          </div>
          <small className="muted">
            SKU: {product.sku} · Illustrative demo product
          </small>
        </section>
      </div>
      <section className="spec-section">
        <p className="eyebrow">THE DETAILS THAT MATTER</p>
        <h2>Technical specifications</h2>
        <dl className="spec-list">
          {product.specs.map((spec) => (
            <div key={spec.id}>
              <dt>{spec.name}</dt>
              <dd>{spec.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function Field({ label, name, errors, ...props }) {
  const message = errors?.[name]?.[0];
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        aria-invalid={Boolean(message)}
        aria-describedby={message ? `${name}-error` : undefined}
        {...props}
      />
      {message && (
        <small className="field-error" id={`${name}-error`}>
          {message}
        </small>
      )}
    </div>
  );
}

function AuthPage({ register = false }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  if (user) return <Navigate to="/account" replace />;
  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api(register ? "/auth/register" : "/auth/login", {
        method: "POST",
        body,
      });
      setUser(result.user);
      navigate("/account", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="shell auth-layout">
      <aside className="auth-intro">
        <p className="eyebrow">A LITTLE MORE POSSIBILITY</p>
        <h1>
          Your next chapter.
          <br />
          <span>Your own space.</span>
        </h1>
        <p>Keep your details together and get ready for what comes next.</p>
        <img
          src="/images/desktop.svg"
          alt="Illustration of a desktop computer"
          width="480"
          height="360"
        />
      </aside>
      <section className="form-card">
        <Link to="/" className="back-link">
          ← Back to products
        </Link>
        <h2>{register ? "Make yourself at home." : "Welcome back."}</h2>
        <p className="muted">
          {register
            ? "Create your PCBuilder account."
            : "Sign in to your PCBuilder account."}
        </p>
        {error && <Message error>{error.message}</Message>}
        <form onSubmit={submit}>
          {register && (
            <Field
              label="Full name"
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
              errors={error?.fields}
            />
          )}
          <Field
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            errors={error?.fields}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? 8 : undefined}
            maxLength={128}
            required
            errors={error?.fields}
          />
          {register && (
            <p className="form-hint">
              Use 8–128 characters. You can update your name and phone number
              later.
            </p>
          )}
          <button className="button button-full" disabled={pending}>
            {pending ? "Please wait…" : register ? "Create account" : "Sign in"}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <p className="form-switch">
          {register ? "Already have an account?" : "New around here?"}{" "}
          <Link to={register ? "/login" : "/register"}>
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </div>
  );
}

function Protected({ admin = false }) {
  const { user, loading, error } = useAuth();
  if (loading)
    return (
      <div className="shell page-section">
        <Message>Checking your session…</Message>
      </div>
    );
  if (error)
    return (
      <div className="shell page-section">
        <Message error>{error} Refresh to reconnect.</Message>
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "ADMIN")
    return (
      <div className="shell page-section">
        <Message error>This page requires an administrator account.</Message>
        <Link to="/">Back to products</Link>
      </div>
    );
  return <Outlet />;
}

function Account() {
  const { user, setUser } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api("/account", { method: "PATCH", body });
      setUser(result.user);
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="shell page-section">
      <p className="eyebrow">YOUR OWN SPACE</p>
      <h1 className="page-title">Hello, {user.name.split(" ")[0]}.</h1>
      <p className="muted">Your account details, all in one place.</p>
      <div className="account-grid">
        <aside className="account-summary">
          <span className="avatar avatar-large">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className="role-badge">
            {user.role === "ADMIN" ? "Administrator" : "Customer"}
          </span>
          {user.role === "ADMIN" && (
            <Link to="/admin">Open admin overview ↗</Link>
          )}
        </aside>
        <section className="form-card profile-card">
          <h2>Personal information</h2>
          <p className="muted">Keep your contact details up to date.</p>
          {error && <Message error>{error.message}</Message>}
          {saved && <Message>Your profile has been saved.</Message>}
          <form onSubmit={submit} onChange={() => setSaved(false)}>
            <Field
              label="Full name"
              name="name"
              autoComplete="name"
              defaultValue={user.name}
              minLength={2}
              maxLength={80}
              required
              errors={error?.fields}
            />
            <Field
              label="Email address"
              name="email"
              type="email"
              value={user.email}
              disabled
            />
            <p className="form-hint">
              Email changes are outside the current sprint.
            </p>
            <Field
              label="Phone number (optional)"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={20}
              defaultValue={user.phone ?? ""}
              errors={error?.fields}
            />
            <button className="button" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function Admin() {
  const { data, error, loading } = useRemote("/admin/overview");
  return (
    <div className="shell page-section">
      <p className="eyebrow">ADMINISTRATOR WORKSPACE</p>
      <h1 className="page-title">Store overview.</h1>
      <p className="muted">
        Access is checked by the backend on every request.
      </p>
      {loading ? (
        <Message>Loading overview…</Message>
      ) : error ? (
        <Message error>{error.message}</Message>
      ) : (
        <div className="overview-grid">
          <div>
            <span>Active products</span>
            <strong>{data.products}</strong>
          </div>
          <div>
            <span>Customer accounts</span>
            <strong>{data.customers}</strong>
          </div>
        </div>
      )}
      <Message>
        Manage products, specifications, images and stock in the catalog editor.
        Process customer orders in the order queue.
      </Message>
      <Link className="button" to="/admin/products">
        Manage catalog ↗
      </Link>
      <Link
        className="button button-secondary admin-orders-link"
        to="/admin/orders"
      >
        Manage orders ↗
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Catalog />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="login" element={<AuthPage key="login" />} />
        <Route path="register" element={<AuthPage key="register" register />} />
        <Route element={<Protected />}>
          <Route path="account" element={<Account />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderReceipt />} />
        </Route>
        <Route element={<Protected admin />}>
          <Route path="admin" element={<Admin />} />
          <Route path="admin/products" element={<AdminCatalog />} />
          <Route path="admin/orders" element={<OrdersPage admin />} />
          <Route path="admin/orders/:id" element={<OrderReceipt admin />} />
        </Route>
        <Route
          path="*"
          element={
            <div className="shell page-section">
              <h1 className="page-title">Page not found.</h1>
              <Link to="/">Back to products</Link>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
