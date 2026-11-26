import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "./api.js";
import useRemote from "./useRemote.js";
import { money } from "./format.js";
import { viDate } from "./vi.js";
import { Notice, Totals } from "./shop-ui.jsx";

const states = ["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED"];
const payments = ["PENDING", "PAID", "FAILED", "REFUNDED"];
const forward = {
  PENDING: "CONFIRMED",
  CONFIRMED: "SHIPPING",
  SHIPPING: "DELIVERED",
};
const labels = {
  PENDING: "Đang chờ",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
  PAID: "Đã thanh toán",
  FAILED: "Thất bại",
  REFUNDED: "Đã hoàn tiền",
  CUSTOMER: "Khách hàng",
  ADMIN: "Quản trị viên",
  COD: "Thanh toán khi nhận hàng",
  SIMULATED: "Thanh toán mô phỏng",
};
const label = (value) => labels[value] ?? value ?? "—";
const actions = {
  PLACED: "Đã đặt hàng",
  IMPORTED: "Dữ liệu đơn hàng đã nhập",
  CONFIRMED: "Đã xác nhận đơn hàng",
  SHIPPING: "Đã giao cho đơn vị vận chuyển",
  DELIVERED: "Đã giao hàng",
  CANCELLED: "Đã hủy đơn và hoàn tồn kho",
  SIMULATED_PAID: "Thanh toán mô phỏng thành công",
  SIMULATED_FAILED: "Thanh toán mô phỏng thất bại",
  COD_COLLECTED: "Đã xác nhận thu tiền COD",
};
const descriptions = {
  PENDING: "Đang chờ quản trị viên xác nhận.",
  CONFIRMED: "Đơn hàng đã được xác nhận và đang chuẩn bị.",
  SHIPPING: "Đơn hàng đang trên đường giao đến bạn.",
  DELIVERED: "Đơn hàng đã được giao.",
  CANCELLED: "Đơn hàng đã bị hủy và hàng đã được hoàn vào kho.",
};
function Badge({ value }) {
  return (
    <span className={`order-badge state-${value.toLowerCase()}`}>
      {label(value)}
    </span>
  );
}

export function OrdersPage({ admin = false }) {
  const [params, setParams] = useSearchParams();
  const endpoint = admin ? "/admin/orders" : "/orders";
  const { data, loading, error, refresh } = useRemote(`${endpoint}?${params}`);
  const page = data?.page ?? Number(params.get("page") ?? 1);
  function filter(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget))
      if (value) next.set(key, value);
    setParams(next);
  }
  function turn(amount) {
    const next = new URLSearchParams(params);
    next.set("page", String(page + amount));
    setParams(next);
  }
  return (
    <div className="shell page-section">
      <p className="eyebrow">
        {admin ? "KHU VỰC QUẢN TRỊ" : "LỊCH SỬ MUA HÀNG"}
      </p>
      <h1 className="page-title">
        {admin ? "Quản lý đơn hàng." : "Đơn hàng của bạn."}
      </h1>
      {admin && (
        <Link className="back-link" to="/admin">
          ← Tổng quan cửa hàng
        </Link>
      )}
      <form
        key={params.toString()}
        onSubmit={filter}
        className="order-filters"
        aria-label="Lọc đơn hàng"
      >
        <div className="field">
          <label htmlFor="order-search">
            {admin
              ? "Mã đơn, người nhận hoặc email khách hàng"
              : "Mã đơn hàng"}
          </label>
          <input
            id="order-search"
            name="q"
            maxLength={80}
            defaultValue={params.get("q") ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor="order-status">Trạng thái đơn hàng</label>
          <select
            id="order-status"
            name="status"
            defaultValue={params.get("status") ?? ""}
          >
            <option value="">Tất cả trạng thái</option>
            {states.map((value) => (
              <option key={value} value={value}>{label(value)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="payment-status">Trạng thái thanh toán</label>
          <select
            id="payment-status"
            name="paymentStatus"
            defaultValue={params.get("paymentStatus") ?? ""}
          >
            <option value="">Tất cả trạng thái thanh toán</option>
            {payments.map((value) => (
              <option key={value} value={value}>{label(value)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="payment-filter">Phương thức thanh toán</label>
          <select
            id="payment-filter"
            name="paymentMethod"
            defaultValue={params.get("paymentMethod") ?? ""}
          >
            <option value="">Tất cả phương thức</option>
            <option value="COD">COD</option>
            <option value="SIMULATED">Mô phỏng</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="order-after">Từ ngày (UTC)</label>
          <input
            id="order-after"
            name="after"
            type="date"
            defaultValue={params.get("after") ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor="order-before">Đến ngày (UTC)</label>
          <input
            id="order-before"
            name="before"
            type="date"
            defaultValue={params.get("before") ?? ""}
          />
        </div>
        <div className="order-actions">
          <button className="button button-small">Áp dụng bộ lọc</button>
          <button
            className="text-button"
            type="button"
            onClick={() => setParams({})}
          >
            Xóa lọc
          </button>
        </div>
      </form>
      <div className="order-list-heading">
        <p className="muted">
          {data ? `${data.total} đơn hàng phù hợp` : "Lịch sử đơn hàng"}
        </p>
        <button className="text-button" onClick={refresh} disabled={loading}>
          Làm mới đơn hàng
        </button>
      </div>
      {loading ? (
        <Notice>Đang tải đơn hàng…</Notice>
      ) : error ? (
        <Notice error>{error.message}</Notice>
      ) : !data.orders.length ? (
        <Notice>
          Không có đơn hàng phù hợp với bộ lọc.{" "}
          {!admin && <Link to="/">Khám phá sản phẩm</Link>}
        </Notice>
      ) : (
        <>
          <div className="table-scroll">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Đơn hàng</th>
                  {admin && <th>Khách hàng</th>}
                  <th>Ngày đặt</th>
                  <th>Trạng thái</th>
                  <th>Thanh toán</th>
                  <th>Tổng cộng</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`${admin ? "/admin" : ""}/orders/${order.id}`}>
                        {order.reference}
                      </Link>
                    </td>
                    {admin && (
                      <td>
                        {order.recipientName}
                        <small className="order-email">
                          {order.user.email}
                        </small>
                      </td>
                    )}
                    <td>{viDate(order.createdAt)}</td>
                    <td>
                      <Badge value={order.status} />
                    </td>
                    <td>
                      <Badge value={order.paymentStatus} />
                      <small className="order-email">
                        {label(order.paymentMethod)}
                      </small>
                    </td>
                    <td>{money(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!loading && !error && (data.total > data.pageSize || page > 1) && (
        <nav className="pagination-row" aria-label="Trang đơn hàng">
          <button
            className="button button-secondary"
            disabled={page <= 1}
            onClick={() => turn(-1)}
          >
            Trước
          </button>
          <span>Trang {page}</span>
          <button
            className="button button-secondary"
            disabled={page * data.pageSize >= data.total}
            onClick={() => turn(1)}
          >
            Tiếp
          </button>
        </nav>
      )}
    </div>
  );
}

export function OrderReceipt({ admin = false }) {
  const { id } = useParams();
  const endpoint = `${admin ? "/admin" : ""}/orders/${id}`;
  const { data, error, loading, refresh } = useRemote(endpoint);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirm, setConfirm] = useState(null);
  async function change(action, body, method = "POST") {
    setPending(true);
    setMessage(null);
    try {
      await api(`${endpoint}/${action}`, {
        method,
        body: { version: data.order.version, ...body },
      });
      setMessage({ text: "Đã cập nhật đơn hàng." });
    } catch (err) {
      setMessage({
        error: true,
        text: `${err.message} Đang tải thông tin mới nhất. Hãy kiểm tra kết quả trước khi thử lại.`,
      });
    } finally {
      setConfirm(null);
      setPending(false);
      refresh();
    }
  }
  const order = data?.order;
  const unpaidSimulation =
    order?.paymentMethod === "SIMULATED" && order.paymentStatus !== "PAID";
  return (
    <div className="shell page-section">
      <Link className="back-link" to={admin ? "/admin/orders" : "/orders"}>
        ← {admin ? "Quản lý đơn hàng" : "Đơn hàng của bạn"}
      </Link>
      <p className="eyebrow">
        {admin ? "XỬ LÝ ĐƠN HÀNG" : "CHI TIẾT ĐƠN HÀNG"}
      </p>
      {message && (
        <div role="status">
          <Notice error={message.error}>{message.text}</Notice>
        </div>
      )}
      {loading ? (
        <Notice>Đang tải đơn hàng…</Notice>
      ) : error ? (
        <Notice error>
          {error.message}{" "}
          <button className="text-button" onClick={refresh}>
            Thử lại
          </button>
        </Notice>
      ) : (
        <>
          <div className="order-list-heading">
            <h1 className="page-title">
              {order.status === "PENDING"
                ? "Đã nhận đơn hàng."
                : `Đơn hàng: ${label(order.status).toLowerCase()}.`}
            </h1>
            <button
              className="text-button"
              onClick={() => {
                setConfirm(null);
                refresh();
              }}
              disabled={pending}
            >
              Làm mới chi tiết
            </button>
          </div>
          <p className="muted">{descriptions[order.status]}</p>
          {order.status !== "CANCELLED" && (
            <ol className="order-progress" aria-label="Tiến trình đơn hàng">
              {states.slice(0, 4).map((state, index) => (
                <li
                  key={state}
                  className={
                    index <= states.indexOf(order.status) ? "reached" : ""
                  }
                  aria-current={state === order.status ? "step" : undefined}
                >
                  {label(state)}
                </li>
              ))}
            </ol>
          )}
          <div className="checkout-grid">
            <section>
              <div className="receipt-info">
                <h2>{order.reference}</h2>
                <div className="order-actions">
                  <span>
                    Đơn hàng: <Badge value={order.status} />
                  </span>
                  <span>
                    Thanh toán: <Badge value={order.paymentStatus} /> (
                    {label(order.paymentMethod)})
                  </span>
                </div>
                <p className="muted">
                  Đặt lúc {new Date(order.createdAt).toLocaleString("vi-VN")}
                </p>
                {admin && (
                  <p>
                    Khách hàng: {order.user.name} · {order.user.email}
                    {!order.user.active && " (tài khoản đã vô hiệu hóa)"}
                  </p>
                )}
                <h3 className="small-heading">Thông tin giao hàng</h3>
                <p className="delivery-address">
                  {order.recipientName}
                  <br />
                  {order.phone}
                  <br />
                  {order.address}
                </p>
              </div>
              <ul className="receipt-items">
                {order.items.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.productName}</strong>
                      <small>
                        {item.sku} · {money(item.unitPrice)} × {item.quantity}
                      </small>
                    </div>
                    <strong>{money(item.lineTotal)}</strong>
                  </li>
                ))}
              </ul>
              <section className="order-history" aria-label="Lịch sử xử lý đơn">
                <h2>Lịch sử xử lý đơn</h2>
                <ol>
                  {order.events.map((event) => (
                    <li key={event.id}>
                      <strong>
                        {actions[event.action] ?? label(event.action)}
                      </strong>
                      <small>
                        {viDate(event.createdAt, true)} ·{" "}
                        {event.actorRole ? label(event.actorRole) : "Hệ thống"}
                      </small>
                      <span>
                        {label(event.status)} · Thanh toán: {label(event.paymentStatus)}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </section>
            <aside className="summary-card">
              <h2>Tổng tiền đơn hàng</h2>
              <Totals data={order} />
              <section className="order-controls" aria-label="Thao tác đơn hàng">
                {!admin &&
                  order.paymentMethod === "SIMULATED" &&
                  order.status === "PENDING" &&
                  order.paymentStatus !== "PAID" && (
                    <>
                      <h3 className="small-heading">Thanh toán mô phỏng</h3>
                      <p className="form-hint">
                        Không có giao dịch thật. Hàng được giữ cho đến khi bạn thanh toán hoặc hủy đơn. Có thể thử lại nếu thanh toán thất bại.
                      </p>
                      {order.paymentStatus === "FAILED" && (
                        <Notice error>
                          Thanh toán mô phỏng thất bại. Hãy thử lại hoặc hủy đơn hàng.
                        </Notice>
                      )}
                      <button
                        className="button button-full"
                        disabled={pending}
                        onClick={() =>
                          change("simulated-payment", { outcome: "SUCCESS" })
                        }
                      >
                        Mô phỏng thanh toán thành công
                      </button>
                      <button
                        className="button button-secondary button-full"
                        disabled={pending}
                        onClick={() =>
                          change("simulated-payment", { outcome: "FAILURE" })
                        }
                      >
                        Mô phỏng thanh toán thất bại
                      </button>
                    </>
                  )}
                {admin && forward[order.status] && (
                  <>
                    <button
                      className="button button-full"
                      disabled={pending || unpaidSimulation}
                      onClick={() =>
                        change(
                          "status",
                          { status: forward[order.status] },
                          "PATCH",
                        )
                      }
                    >
                      {
                        {
                          PENDING: "Xác nhận đơn hàng",
                          CONFIRMED: "Chuyển sang đang giao",
                          SHIPPING: "Đánh dấu đã giao",
                        }[order.status]
                      }
                    </button>
                    {unpaidSimulation && (
                      <p className="form-hint">
                        Cần thanh toán mô phỏng thành công trước khi xác nhận đơn.
                      </p>
                    )}
                  </>
                )}
                {order.status === "PENDING" && (
                  <button
                    className="button button-secondary button-full"
                    disabled={pending}
                    onClick={() => setConfirm("cancel")}
                  >
                    Hủy đơn hàng
                  </button>
                )}
                {admin &&
                  order.status === "DELIVERED" &&
                  order.paymentMethod === "COD" &&
                  order.paymentStatus === "PENDING" && (
                    <button
                      className="button button-full"
                      disabled={pending}
                      onClick={() => setConfirm("collect")}
                    >
                      Xác nhận đã thu tiền COD
                    </button>
                  )}
                {confirm && (
                  <div
                    className="order-confirm"
                    role="group"
                    aria-label="Xác nhận thao tác"
                  >
                    <p>
                      {confirm === "cancel"
                        ? `Hủy đơn hàng đang chờ và hoàn lại tồn kho?${order.paymentStatus === "PAID" ? " Khoản thanh toán mô phỏng sẽ được đánh dấu đã hoàn tiền." : ""}`
                        : "Bạn xác nhận đã thu đủ tiền COD?"}
                    </p>
                    <div className="order-actions">
                      <button
                        className="button button-small"
                        disabled={pending}
                        onClick={() =>
                          confirm === "cancel"
                            ? change(
                                admin ? "status" : "cancel",
                                admin ? { status: "CANCELLED" } : {},
                                admin ? "PATCH" : "POST",
                              )
                            : change("collect-cod", {})
                        }
                      >
                        Có,{" "}
                        {confirm === "cancel"
                          ? "hủy đơn hàng"
                          : "xác nhận đã thu tiền"}
                      </button>
                      <button
                        className="text-button"
                        disabled={pending}
                        onClick={() => setConfirm(null)}
                      >
                        Giữ nguyên đơn hàng
                      </button>
                    </div>
                  </div>
                )}
                {pending && <p role="status">Đang cập nhật đơn hàng…</p>}
                {order.paymentMethod === "COD" &&
                  order.paymentStatus === "PENDING" &&
                  order.status !== "CANCELLED" && (
                    <p className="form-hint">
                      Thanh toán COD vẫn ở trạng thái chờ cho đến khi quản trị viên xác nhận đã thu tiền sau khi giao hàng.
                    </p>
                  )}
                {order.paymentStatus === "REFUNDED" && (
                  <p className="form-hint">
                    Khoản thanh toán mô phỏng đã được hoàn khi hủy đơn đang chờ. Không có giao dịch tiền thật.
                  </p>
                )}
              </section>
              <Link to={admin ? "/admin/orders" : "/"} className="back-link">
                {admin ? "Quay lại danh sách đơn hàng" : "Tiếp tục mua sắm ↗"}
              </Link>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
