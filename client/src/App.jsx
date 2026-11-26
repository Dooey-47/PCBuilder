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
import { viText } from "./vi.js";
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
        Bỏ qua đến nội dung
      </a>
      <div className="announcement">
        Lựa chọn rõ ràng hơn cho bộ máy tính tiếp theo.
      </div>
      <header className="site-header">
        <div className="shell header-inner">
          <Link to="/" className="brand" aria-label="Trang chủ PCBuilder">
            <span className="brand-mark">
              p<span>c</span>
            </span>
            <span>
              PCBuilder<span className="brand-dot">.</span>
            </span>
          </Link>
          <nav className="header-nav" aria-label="Điều hướng chính">
            <NavLink to="/" end>
              Khám phá sản phẩm
            </NavLink>
            {user && (
              <>
                <NavLink to="/cart">Giỏ hàng ({cart?.quantity ?? 0})</NavLink>
                <NavLink to="/orders">Đơn hàng của tôi</NavLink>
              </>
            )}
            {user?.role === "ADMIN" && <NavLink to="/admin">Quản trị</NavLink>}
          </nav>
          <div className="account-nav">
            {loading ? (
              <span className="muted">Đang kết nối…</span>
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
                  {signingOut ? "Đang đăng xuất…" : "Đăng xuất"}
                </button>
              </>
            ) : (
              <>
                <Link className="text-button" to="/login">
                  Đăng nhập
                </Link>
                <Link className="button button-small" to="/register">
                  Tạo tài khoản <span aria-hidden="true">↗</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      {(error || logoutError) && (
        <div className="shell">
          <Message error>{logoutError || `Dịch vụ tài khoản: ${error}`}</Message>
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
          <p>Công nghệ phù hợp. Lựa chọn rõ ràng.</p>
          <span>Máy tính và linh kiện cho mọi nhu cầu</span>
        </div>
      </footer>
    </>
  );
}

function Stock({ stock }) {
  return (
    <span className={`stock ${stock ? "" : "stock-empty"}`}>
      <span aria-hidden="true">●</span>{" "}
      {stock ? `${stock} còn hàng` : "Hết hàng"}
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
        <Message>Đang tải sản phẩm…</Message>
      </div>
    );
  if (error)
    return (
      <div className="shell page-section">
        <Message error>{error.message}</Message>
        <Link to="/">Quay lại sản phẩm</Link>
      </div>
    );
  const { product } = data;
  const image = product.images[imageIndex] ?? product.images[0];
  return (
    <div className="shell page-section">
      <nav className="breadcrumbs" aria-label="Đường dẫn điều hướng">
        <Link to="/">Sản phẩm</Link>
        <span aria-hidden="true">/</span>
        <span>{product.name}</span>
      </nav>
      <div className="detail-grid">
        <div>
          <div className="detail-image">
            {image && (
              <img src={image.url} alt={viText(image.alt)} width="480" height="360" />
            )}
          </div>
          {product.images.length > 1 && (
            <div className="image-choices">
              {product.images.map((item, index) => (
                <button
                  key={item.id}
                  aria-label={`Xem ảnh sản phẩm ${index + 1}`}
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
            {product.brand.name} · {viText(product.category.name)}
          </p>
          <h1>{product.name}</h1>
          <p className="detail-description">{viText(product.description)}</p>
          <strong className="detail-price">{money(product.price)}</strong>
          <Stock stock={product.stock} />
          <p className="warranty">
            <span aria-hidden="true">✓</span> {viText(product.warrantyText)}
          </p>
          <AddToCart product={product} />
          <div className="detail-next">
            <strong>Sẵn sàng cho bộ máy tính tiếp theo?</strong>
            <p>
              Thêm vào giỏ hàng, kiểm tra thông tin giao hàng rồi thanh toán khi nhận hàng.
            </p>
          </div>
        </section>
      </div>
      <section className="spec-section">
        <p className="eyebrow">THÔNG TIN CẦN BIẾT</p>
        <h2>Thông số kỹ thuật</h2>
        <dl className="spec-list">
          {product.specs.map((spec) => (
            <div key={spec.id}>
              <dt>{viText(spec.name)}</dt>
              <dd>{viText(spec.value)}</dd>
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
        <p className="eyebrow">THÊM NHIỀU KHẢ NĂNG</p>
        <h1>
          Bước tiếp theo của bạn.
          <br />
          <span>Không gian của riêng bạn.</span>
        </h1>
        <p>Lưu thông tin của bạn để sẵn sàng cho những lựa chọn tiếp theo.</p>
        <img
          src="/images/desktop.svg"
          alt="Máy tính để bàn"
          width="480"
          height="360"
        />
      </aside>
      <section className="form-card">
        <Link to="/" className="back-link">
          ← Quay lại sản phẩm
        </Link>
        <h2>{register ? "Tạo tài khoản của bạn." : "Chào mừng bạn trở lại."}</h2>
        <p className="muted">
          {register
            ? "Tạo tài khoản PCBuilder của bạn."
            : "Đăng nhập vào tài khoản PCBuilder của bạn."}
        </p>
        {error && <Message error>{error.message}</Message>}
        <form onSubmit={submit}>
          {register && (
            <Field
              label="Họ và tên"
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
              errors={error?.fields}
            />
          )}
          <Field
            label="Địa chỉ email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            errors={error?.fields}
          />
          <Field
            label="Mật khẩu"
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
              Dùng mật khẩu từ 8 đến 128 ký tự. Bạn có thể cập nhật họ tên và số điện thoại sau.
            </p>
          )}
          <button className="button button-full" disabled={pending}>
            {pending ? "Vui lòng chờ…" : register ? "Tạo tài khoản" : "Đăng nhập"}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <p className="form-switch">
          {register ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
          <Link to={register ? "/login" : "/register"}>
            {register ? "Đăng nhập" : "Tạo tài khoản"}
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
        <Message>Đang kiểm tra phiên đăng nhập…</Message>
      </div>
    );
  if (error)
    return (
      <div className="shell page-section">
        <Message error>{error} Tải lại trang để kết nối lại.</Message>
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "ADMIN")
    return (
      <div className="shell page-section">
        <Message error>Trang này yêu cầu tài khoản quản trị viên.</Message>
        <Link to="/">Quay lại sản phẩm</Link>
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
      <p className="eyebrow">TÀI KHOẢN CỦA BẠN</p>
      <h1 className="page-title">Xin chào, {user.name.split(" ")[0]}.</h1>
      <p className="muted">Thông tin tài khoản của bạn tại đây.</p>
      <div className="account-grid">
        <aside className="account-summary">
          <span className="avatar avatar-large">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className="role-badge">
            {user.role === "ADMIN" ? "Quản trị viên" : "Khách hàng"}
          </span>
          {user.role === "ADMIN" && (
            <Link to="/admin">Mở trang quản trị ↗</Link>
          )}
        </aside>
        <section className="form-card profile-card">
          <h2>Thông tin cá nhân</h2>
          <p className="muted">Cập nhật thông tin liên hệ của bạn.</p>
          {error && <Message error>{error.message}</Message>}
          {saved && <Message>Đã lưu thông tin cá nhân.</Message>}
          <form onSubmit={submit} onChange={() => setSaved(false)}>
            <Field
              label="Họ và tên"
              name="name"
              autoComplete="name"
              defaultValue={user.name}
              minLength={2}
              maxLength={80}
              required
              errors={error?.fields}
            />
            <Field
              label="Địa chỉ email"
              name="email"
              type="email"
              value={user.email}
              disabled
            />
            <p className="form-hint">
              Hiện chưa hỗ trợ thay đổi email.
            </p>
            <Field
              label="Số điện thoại (không bắt buộc)"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={20}
              defaultValue={user.phone ?? ""}
              errors={error?.fields}
            />
            <button className="button" disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu thay đổi"}
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
      <p className="eyebrow">KHU VỰC QUẢN TRỊ</p>
      <h1 className="page-title">Tổng quan cửa hàng.</h1>
      <p className="muted">
        Quyền truy cập được kiểm tra trên mỗi yêu cầu.
      </p>
      {loading ? (
        <Message>Đang tải tổng quan…</Message>
      ) : error ? (
        <Message error>{error.message}</Message>
      ) : (
        <div className="overview-grid">
          <div>
            <span>Sản phẩm đang bán</span>
            <strong>{data.products}</strong>
          </div>
          <div>
            <span>Tài khoản khách hàng</span>
            <strong>{data.customers}</strong>
          </div>
        </div>
      )}
      <Message>
        Quản lý sản phẩm, thông số, hình ảnh và tồn kho trong danh mục. Xử lý đơn hàng trong danh sách đơn.
      </Message>
      <Link className="button" to="/admin/products">
        Quản lý danh mục ↗
      </Link>
      <Link
        className="button button-secondary admin-orders-link"
        to="/admin/orders"
      >
        Quản lý đơn hàng ↗
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
              <h1 className="page-title">Không tìm thấy trang.</h1>
              <Link to="/">Quay lại sản phẩm</Link>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
