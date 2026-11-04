import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api } from "./api.js";
import { useAuth } from "./auth-context.js";

const money = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value));

function useRemote(path) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    let active = true;
    api(path)
      .then((data) => {
        if (active) setResult({ path, data });
      })
      .catch((error) => {
        if (active) setResult({ path, error });
      });
    return () => {
      active = false;
    };
  }, [path]);
  return result?.path === path
    ? { ...result, loading: false }
    : { loading: true };
}

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

function ProductCard({ product }) {
  const image = product.images[0];
  return (
    <article className="product-card">
      <Link
        to={`/products/${product.id}`}
        className="product-image-link"
        aria-label={`View ${product.name}`}
      >
        <span className="product-category">{product.category.name}</span>
        {image && (
          <img
            src={image.url}
            alt={image.alt}
            loading="lazy"
            width="480"
            height="360"
          />
        )}
        <span className="image-arrow" aria-hidden="true">
          ↗
        </span>
      </Link>
      <div className="product-info">
        <p className="eyebrow muted">{product.brand.name}</p>
        <h3>
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </h3>
        <p className="product-spec-preview">
          {product.specs
            .slice(0, 2)
            .map((spec) => spec.value)
            .join(" · ")}
        </p>
        <div className="product-bottom">
          <strong>{money(product.price)}</strong>
          <Stock stock={product.stock} />
        </div>
      </div>
    </article>
  );
}

function Catalog() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const page = Number(params.get("page") ?? 1);
  const categories = useRemote("/categories");
  const catalog = useRemote(
    `/products?${new URLSearchParams({ ...(category ? { category } : {}), page: String(page) })}`,
  );
  const chosen = categories.data?.categories.find(
    (item) => String(item.id) === category,
  );
  function selectCategory(id) {
    setParams(id ? { category: String(id) } : {});
  }
  function setPage(value) {
    setParams({ ...(category ? { category } : {}), page: String(value) });
  }
  return (
    <div className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="blue-dot" /> YOUR NEXT CHAPTER STARTS HERE
          </p>
          <h1>
            Good tech.
            <br />
            <span>Great possibilities.</span>
          </h1>
          <p className="hero-description">
            From your first line of code to your next big idea.
            <br className="desktop-break" /> Find the right tools to make it
            happen.
          </p>
          <a href="#catalog" className="button">
            Explore the collection <span aria-hidden="true">↗</span>
          </a>
          <div className="hero-note">
            <span aria-hidden="true">✓</span> Clear specifications. Upfront
            prices.
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-orbit" />
          <span className="hero-tag">BUILT FOR WHAT’S NEXT</span>
          <img
            src="/images/laptop.svg"
            alt="Illustration of an open laptop"
            width="480"
            height="360"
          />
          <div className="hero-product-label">
            <span>A fresh perspective.</span>
            <strong>
              Aster Air 14 <span aria-hidden="true">↗</span>
            </strong>
          </div>
        </div>
      </section>
      <section className="benefit-strip" aria-label="Catalog information">
        <div>
          <span className="benefit-icon" aria-hidden="true">
            ▦
          </span>
          <span>
            <strong>Everything in one place</strong>
            <small>Laptops, desktops & the details</small>
          </span>
        </div>
        <div>
          <span className="benefit-icon" aria-hidden="true">
            ✓
          </span>
          <span>
            <strong>Know what you’re choosing</strong>
            <small>Specifications & warranty upfront</small>
          </span>
        </div>
        <div>
          <span className="benefit-icon" aria-hidden="true">
            ◎
          </span>
          <span>
            <strong>Availability at a glance</strong>
            <small>Stock shown on every product</small>
          </span>
        </div>
      </section>
      <section id="catalog" className="catalog-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FIND YOUR NEXT ESSENTIAL</p>
            <h2>{chosen?.name ?? "Explore the collection"}</h2>
          </div>
          <span className="muted">
            {catalog.data
              ? `${catalog.data.total} products`
              : "Our demo collection"}
          </span>
        </div>
        <div className="category-tabs" aria-label="Product categories">
          <button
            className={!category ? "selected" : ""}
            aria-pressed={!category}
            onClick={() => selectCategory("")}
          >
            All products
          </button>
          {categories.data?.categories.map((item) => (
            <button
              key={item.id}
              className={category === String(item.id) ? "selected" : ""}
              aria-pressed={category === String(item.id)}
              onClick={() => selectCategory(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
        {categories.error && (
          <Message error>
            Categories could not be loaded. You can still browse all products.
          </Message>
        )}
        {catalog.loading ? (
          <Message>Loading products…</Message>
        ) : catalog.error ? (
          <Message error>
            {catalog.error.message} Check that the backend and PostgreSQL are
            running, then refresh.
          </Message>
        ) : catalog.data.products.length ? (
          <div className="product-grid">
            {catalog.data.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <Message>
            No products on this page.{" "}
            <button className="text-button" onClick={() => setParams({})}>
              View all products
            </button>
          </Message>
        )}
        {catalog.data && catalog.data.total > catalog.data.pageSize && (
          <nav className="pagination-row" aria-label="Product pages">
            <button
              className="button button-secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of{" "}
              {Math.ceil(catalog.data.total / catalog.data.pageSize)}
            </span>
            <button
              className="button button-secondary"
              disabled={page * catalog.data.pageSize >= catalog.data.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </nav>
        )}
        <p className="demo-note">
          Illustrative products, configurations and prices for a student
          project. Checkout arrives in the next sprint.
        </p>
      </section>
    </div>
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
          <div className="detail-next">
            <strong>Getting to know your next setup?</strong>
            <p>
              Explore the specifications below. Cart and checkout are coming in
              Sprint 2.
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
        Catalog editing, inventory management, and order processing will be
        added in later sprints.
      </Message>
      <Link to="/">Explore the storefront ↗</Link>
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
        </Route>
        <Route element={<Protected admin />}>
          <Route path="admin" element={<Admin />} />
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
