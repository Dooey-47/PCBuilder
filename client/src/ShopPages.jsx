import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "./api.js";
import { useAuth } from "./auth-context.js";
import { useShop } from "./shop-context.js";
import { money } from "./format.js";
import { viText } from "./vi.js";
import { Notice, Totals } from "./shop-ui.jsx";

function CartRow({ item, mutate, pending, onError }) {
  async function quantity(event) {
    event.preventDefault();
    try {
      await mutate(
        item.productId,
        Number(new FormData(event.currentTarget).get("quantity")),
      );
      onError("");
    } catch (error) {
      onError(error.message);
    }
  }
  async function remove() {
    try {
      await mutate(item.productId, null);
      onError("");
    } catch (error) {
      onError(error.message);
    }
  }
  return (
    <article className="cart-row">
      {item.image && (
        <img
          src={item.image.url}
          alt={viText(item.image.alt)}
          width="100"
          height="80"
        />
      )}
      <div className="cart-item-copy">
        <h2>
          {item.active ? (
            <Link to={`/products/${item.productId}`}>{item.name}</Link>
          ) : (
            item.name
          )}
        </h2>
        <p>{money(item.unitPrice)} / sản phẩm</p>
        <small className={item.available ? "stock" : "field-error"}>
          {!item.active
            ? "Không còn bán"
            : item.available
              ? `${item.stock} còn hàng`
              : `Chỉ còn ${item.stock} sản phẩm; hãy giảm số lượng hoặc xóa sản phẩm này.`}
        </small>
      </div>
      <form
        onSubmit={quantity}
        className="quantity-form"
        key={`${item.productId}-${item.quantity}`}
      >
        <label htmlFor={`quantity-${item.productId}`}>Số lượng</label>
        <input
          id={`quantity-${item.productId}`}
          name="quantity"
          type="number"
          min="1"
          max="999"
          step="1"
          defaultValue={item.quantity}
          required
          disabled={pending}
        />
        <button className="text-button" disabled={pending}>
          Cập nhật
        </button>
      </form>
      <div className="cart-item-total">
        <strong>{money(item.lineTotal)}</strong>
        <button className="text-button" disabled={pending} onClick={remove}>
          Xóa
        </button>
      </div>
    </article>
  );
}
export function CartPage() {
  const { cart, loading, error, pending, mutate, refresh } = useShop();
  const [message, setMessage] = useState("");
  return (
    <div className="shell page-section">
      <p className="eyebrow">SẮP HOÀN THÀNH LỰA CHỌN</p>
      <h1 className="page-title">Giỏ hàng của bạn.</h1>
      {loading ? (
        <Notice>Đang tải giỏ hàng…</Notice>
      ) : error ? (
        <Notice error>
          {error.message}{" "}
          <button
            className="text-button"
            onClick={() => refresh().catch((err) => setMessage(err.message))}
          >
            Thử lại
          </button>
        </Notice>
      ) : !cart?.items.length ? (
        <Notice>
          Giỏ hàng của bạn đang trống. <Link to="/">Khám phá sản phẩm ↗</Link>
        </Notice>
      ) : (
        <>
          <p className="muted">
            Giá và tình trạng còn hàng sẽ được kiểm tra lại khi bạn xác nhận. Sản phẩm trong giỏ chưa được giữ trước.
          </p>
          {message && <Notice error>{message}</Notice>}
          <div className="checkout-grid">
            <section aria-label="Sản phẩm trong giỏ">
              {cart.items.map((item) => (
                <CartRow
                  key={item.productId}
                  item={item}
                  mutate={mutate}
                  pending={pending}
                  onError={setMessage}
                />
              ))}
            </section>
            <aside className="summary-card">
              <h2>Tóm tắt đơn hàng</h2>
              <Totals data={cart} />
              {cart.canCheckout ? (
                <Link className="button button-full" to="/checkout">
                  Tiếp tục thanh toán ↗
                </Link>
              ) : (
                <Notice error>Hãy cập nhật sản phẩm không còn bán trước khi thanh toán.</Notice>
              )}
              <Link className="back-link" to="/">
                ← Tiếp tục mua sắm
              </Link>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function storedAttempt(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function storeAttempt(key, value) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch {
    /* Retry state remains available in memory if browser storage is disabled. */
  }
}

export function CheckoutPage() {
  const { user } = useAuth();
  const shop = useShop();
  const navigate = useNavigate();
  const storageKey = `pcbuilder-checkout-${user.id}`;
  const [attempt, setAttempt] = useState(() => storedAttempt(storageKey));
  const [pending, setPending] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [error, setError] = useState(null);
  async function send(value) {
    setPending(true);
    setError(null);
    try {
      const { order } = await api("/orders", {
        method: "POST",
        headers: { "Idempotency-Key": value.key },
        body: value.body,
      });
      storeAttempt(storageKey, null);
      setAttempt(null);
      await shop.refresh().catch(() => {});
      navigate(`/orders/${order.id}`, { replace: true });
    } catch (err) {
      setError(err);
      if (err.status === 409 || err.status === 422) {
        storeAttempt(storageKey, null);
        setAttempt(null);
        await shop.refresh().catch(() => {});
      }
      // A network/503 error has an unknown outcome: keep the exact body and key for a safe retry.
    } finally {
      setPending(false);
    }
  }
  async function submit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const value = {
      key: crypto.randomUUID(),
      body: { ...fields, cartToken: shop.cart.token },
    };
    storeAttempt(storageKey, value);
    setAttempt(value);
    await send(value);
  }
  return (
    <div className="shell page-section">
      <nav className="breadcrumbs">
        <Link to="/cart">Giỏ hàng</Link>
        <span>/</span>
        <span>Thanh toán</span>
      </nav>
      <p className="eyebrow">HOÀN TẤT THÔNG TIN</p>
      <h1 className="page-title">Hoàn tất đơn hàng.</h1>
      {error && <Notice error>{error.message}</Notice>}
      {attempt && (
        <Notice>
          Lần đặt hàng trước chưa có kết quả rõ ràng. Hãy gửi lại cùng yêu cầu để lấy kết quả mà không tạo đơn trùng.
          <button
            className="button button-small retry-checkout"
            disabled={pending}
            onClick={() => send(attempt)}
          >
            {pending ? "Đang xác nhận…" : "Thử lại lần đặt hàng này"}
          </button>
        </Notice>
      )}
      {shop.loading ? (
        <Notice>Đang tải trang thanh toán…</Notice>
      ) : shop.error ? (
        <Notice error>{shop.error.message}</Notice>
      ) : !shop.cart?.items.length ? (
        <Notice>
          {attempt ? (
            "Giỏ hàng có thể đã được xóa sau lần đặt trước. Hãy dùng nút thử lại phía trên để lấy thông tin đơn hàng."
          ) : (
            <>
              Giỏ hàng của bạn đang trống. <Link to="/">Xem sản phẩm</Link>
            </>
          )}
        </Notice>
      ) : (
        <div className="checkout-grid">
          <section className="form-card checkout-form">
            <h2>Thông tin giao hàng</h2>
            <p className="muted">
              Các trường bắt buộc được đánh dấu *. Thông tin giao hàng sẽ được lưu cùng đơn hàng.
            </p>
            <form onSubmit={submit}>
              <fieldset disabled={pending || Boolean(attempt)}>
                <div className="field">
                  <label htmlFor="recipientName">Tên người nhận *</label>
                  <input
                    id="recipientName"
                    name="recipientName"
                    autoComplete="shipping name"
                    minLength={2}
                    maxLength={100}
                    defaultValue={user.name}
                    required
                  />
                  {error?.fields?.recipientName && (
                    <small className="field-error">
                      {error.fields.recipientName[0]}
                    </small>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="delivery-phone">Số điện thoại *</label>
                  <input
                    id="delivery-phone"
                    name="phone"
                    type="tel"
                    autoComplete="shipping tel"
                    minLength={7}
                    maxLength={20}
                    defaultValue={user.phone ?? ""}
                    required
                  />
                  {error?.fields?.phone && (
                    <small className="field-error">
                      {error.fields.phone[0]}
                    </small>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="address">Địa chỉ giao hàng đầy đủ *</label>
                  <textarea
                    id="address"
                    name="address"
                    autoComplete="shipping street-address"
                    minLength={10}
                    maxLength={500}
                    rows={3}
                    required
                  />
                  {error?.fields?.address && (
                    <small className="field-error">
                      {error.fields.address[0]}
                    </small>
                  )}
                </div>
                <h3 className="small-heading">Phương thức thanh toán</h3>
                <div className="field">
                  <label htmlFor="checkout-payment">
                    Chọn phương thức thanh toán
                  </label>
                  <select
                    id="checkout-payment"
                    name="paymentMethod"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                  >
                    <option value="COD">Thanh toán khi nhận hàng (COD)</option>
                    <option value="SIMULATED">
                      Thanh toán mô phỏng
                    </option>
                  </select>
                </div>
                <p className="form-hint">
                  Với COD, bạn thanh toán khi nhận hàng. Với thanh toán mô phỏng, chọn kết quả thành công hoặc thất bại ở trang đơn hàng. Không có giao dịch tiền thật.
                </p>
                <button
                  className="button button-full"
                  disabled={!shop.cart.canCheckout}
                >
                  {pending
                    ? "Đang đặt hàng…"
                    : paymentMethod === "COD"
                      ? "Xác nhận đơn COD"
                      : "Đặt đơn thanh toán mô phỏng"}{" "}
                  ↗
                </button>
              </fieldset>
            </form>
          </section>
          <aside className="summary-card">
            <h2>Đơn hàng của bạn</h2>
            <ul className="summary-items">
              {shop.cart.items.map((item) => (
                <li key={item.productId}>
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <strong>{money(item.lineTotal)}</strong>
                </li>
              ))}
            </ul>
            <Totals data={shop.cart} />
            {!shop.cart.canCheckout && (
              <Notice error>
                Một số sản phẩm không còn bán.{" "}
                <Link to="/cart">Kiểm tra giỏ hàng</Link>
              </Notice>
            )}
            <p className="form-hint">
              Hãy kiểm tra tổng tiền trước khi xác nhận. Nếu giá hoặc tồn kho thay đổi, bạn cần kiểm tra lại.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
