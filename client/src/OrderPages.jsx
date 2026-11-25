import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "./api.js";
import useRemote from "./useRemote.js";
import { money } from "./format.js";
import { Notice, Totals } from "./shop-ui.jsx";

const states = ["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED"];
const payments = ["PENDING", "PAID", "FAILED", "REFUNDED"];
const forward = {
  PENDING: "CONFIRMED",
  CONFIRMED: "SHIPPING",
  SHIPPING: "DELIVERED",
};
const label = (value) =>
  value === "COD"
    ? "COD"
    : value
      ? value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ")
      : "—";
const actions = {
  PLACED: "Order placed",
  IMPORTED: "Imported order snapshot",
  CONFIRMED: "Order confirmed",
  SHIPPING: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled; stock restored",
  SIMULATED_PAID: "Simulated payment succeeded",
  SIMULATED_FAILED: "Simulated payment failed",
  COD_COLLECTED: "COD collection confirmed",
};
const descriptions = {
  PENDING: "Waiting for administrator confirmation.",
  CONFIRMED: "Confirmed and being prepared.",
  SHIPPING: "Your order is on its way.",
  DELIVERED: "Delivery has been completed.",
  CANCELLED: "This order was cancelled. Its stock has been restored.",
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
        {admin ? "ADMINISTRATOR WORKSPACE" : "YOUR PURCHASES"}
      </p>
      <h1 className="page-title">
        {admin ? "Manage orders." : "Your orders."}
      </h1>
      {admin && (
        <Link className="back-link" to="/admin">
          ← Store overview
        </Link>
      )}
      <form
        key={params.toString()}
        onSubmit={filter}
        className="order-filters"
        aria-label="Filter orders"
      >
        <div className="field">
          <label htmlFor="order-search">
            {admin
              ? "Reference, recipient or customer email"
              : "Order reference"}
          </label>
          <input
            id="order-search"
            name="q"
            maxLength={80}
            defaultValue={params.get("q") ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor="order-status">Order status</label>
          <select
            id="order-status"
            name="status"
            defaultValue={params.get("status") ?? ""}
          >
            <option value="">All statuses</option>
            {states.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="payment-status">Payment status</label>
          <select
            id="payment-status"
            name="paymentStatus"
            defaultValue={params.get("paymentStatus") ?? ""}
          >
            <option value="">All payments</option>
            {payments.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="payment-filter">Payment method</label>
          <select
            id="payment-filter"
            name="paymentMethod"
            defaultValue={params.get("paymentMethod") ?? ""}
          >
            <option value="">All methods</option>
            <option value="COD">COD</option>
            <option value="SIMULATED">Simulated</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="order-after">From date (UTC)</label>
          <input
            id="order-after"
            name="after"
            type="date"
            defaultValue={params.get("after") ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor="order-before">Through date (UTC)</label>
          <input
            id="order-before"
            name="before"
            type="date"
            defaultValue={params.get("before") ?? ""}
          />
        </div>
        <div className="order-actions">
          <button className="button button-small">Apply filters</button>
          <button
            className="text-button"
            type="button"
            onClick={() => setParams({})}
          >
            Clear
          </button>
        </div>
      </form>
      <div className="order-list-heading">
        <p className="muted">
          {data ? `${data.total} matching order(s)` : "Order history"}
        </p>
        <button className="text-button" onClick={refresh} disabled={loading}>
          Refresh orders
        </button>
      </div>
      {loading ? (
        <Notice>Loading orders…</Notice>
      ) : error ? (
        <Notice error>{error.message}</Notice>
      ) : !data.orders.length ? (
        <Notice>
          No orders match these filters.{" "}
          {!admin && <Link to="/">Explore products</Link>}
        </Notice>
      ) : (
        <>
          <div className="table-scroll">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Order</th>
                  {admin && <th>Customer</th>}
                  <th>Placed</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
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
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
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
        <nav className="pagination-row" aria-label="Order pages">
          <button
            className="button button-secondary"
            disabled={page <= 1}
            onClick={() => turn(-1)}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            className="button button-secondary"
            disabled={page * data.pageSize >= data.total}
            onClick={() => turn(1)}
          >
            Next
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
      setMessage({ text: "Order updated." });
    } catch (err) {
      setMessage({
        error: true,
        text: `${err.message} The latest details are being loaded. Check the result before retrying.`,
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
        ← {admin ? "Manage orders" : "Your orders"}
      </Link>
      <p className="eyebrow">
        {admin ? "ORDER PROCESSING" : "YOUR ORDER DETAILS"}
      </p>
      {message && (
        <div role="status">
          <Notice error={message.error}>{message.text}</Notice>
        </div>
      )}
      {loading ? (
        <Notice>Loading order…</Notice>
      ) : error ? (
        <Notice error>
          {error.message}{" "}
          <button className="text-button" onClick={refresh}>
            Retry
          </button>
        </Notice>
      ) : (
        <>
          <div className="order-list-heading">
            <h1 className="page-title">
              {order.status === "PENDING"
                ? "Order received."
                : `Order ${label(order.status).toLowerCase()}.`}
            </h1>
            <button
              className="text-button"
              onClick={() => {
                setConfirm(null);
                refresh();
              }}
              disabled={pending}
            >
              Refresh details
            </button>
          </div>
          <p className="muted">{descriptions[order.status]}</p>
          {order.status !== "CANCELLED" && (
            <ol className="order-progress" aria-label="Order progress">
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
                    Order: <Badge value={order.status} />
                  </span>
                  <span>
                    Payment: <Badge value={order.paymentStatus} /> (
                    {label(order.paymentMethod)})
                  </span>
                </div>
                <p className="muted">
                  Placed {new Date(order.createdAt).toLocaleString()}
                </p>
                {admin && (
                  <p>
                    Customer: {order.user.name} · {order.user.email}
                    {!order.user.active && " (inactive account)"}
                  </p>
                )}
                <h3 className="small-heading">Delivery details</h3>
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
              <section className="order-history" aria-label="Order activity">
                <h2>Order activity</h2>
                <ol>
                  {order.events.map((event) => (
                    <li key={event.id}>
                      <strong>
                        {actions[event.action] ?? label(event.action)}
                      </strong>
                      <small>
                        {new Date(event.createdAt).toLocaleString()} ·{" "}
                        {event.actorRole ? label(event.actorRole) : "System"}
                      </small>
                      <span>
                        {label(event.status)} · Payment{" "}
                        {label(event.paymentStatus).toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </section>
            <aside className="summary-card">
              <h2>Order total</h2>
              <Totals data={order} />
              <section className="order-controls" aria-label="Order actions">
                {!admin &&
                  order.paymentMethod === "SIMULATED" &&
                  order.status === "PENDING" &&
                  order.paymentStatus !== "PAID" && (
                    <>
                      <h3 className="small-heading">Demo payment</h3>
                      <p className="form-hint">
                        No real charge. Stock stays reserved until you pay or
                        cancel. Failed payments can be retried.
                      </p>
                      {order.paymentStatus === "FAILED" && (
                        <Notice error>
                          The simulated payment failed. Try again or cancel this
                          order.
                        </Notice>
                      )}
                      <button
                        className="button button-full"
                        disabled={pending}
                        onClick={() =>
                          change("simulated-payment", { outcome: "SUCCESS" })
                        }
                      >
                        Simulate successful payment
                      </button>
                      <button
                        className="button button-secondary button-full"
                        disabled={pending}
                        onClick={() =>
                          change("simulated-payment", { outcome: "FAILURE" })
                        }
                      >
                        Simulate failed payment
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
                          PENDING: "Confirm order",
                          CONFIRMED: "Mark as shipping",
                          SHIPPING: "Mark as delivered",
                        }[order.status]
                      }
                    </button>
                    {unpaidSimulation && (
                      <p className="form-hint">
                        Waiting for a successful simulated payment before
                        confirmation.
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
                    Cancel order
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
                      Record COD collection
                    </button>
                  )}
                {confirm && (
                  <div
                    className="order-confirm"
                    role="group"
                    aria-label="Confirm action"
                  >
                    <p>
                      {confirm === "cancel"
                        ? `Cancel this Pending order and restore its stock?${order.paymentStatus === "PAID" ? " Its demo payment will be marked Refunded." : ""}`
                        : "Confirm that the full COD amount has actually been collected?"}
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
                        Yes,{" "}
                        {confirm === "cancel"
                          ? "cancel order"
                          : "confirm collection"}
                      </button>
                      <button
                        className="text-button"
                        disabled={pending}
                        onClick={() => setConfirm(null)}
                      >
                        Keep order unchanged
                      </button>
                    </div>
                  </div>
                )}
                {pending && <p role="status">Updating order…</p>}
                {order.paymentMethod === "COD" &&
                  order.paymentStatus === "PENDING" &&
                  order.status !== "CANCELLED" && (
                    <p className="form-hint">
                      COD stays Pending until an administrator records
                      collection after delivery.
                    </p>
                  )}
                {order.paymentStatus === "REFUNDED" && (
                  <p className="form-hint">
                    The simulated payment was refunded when this Pending order
                    was cancelled. No real money moved.
                  </p>
                )}
              </section>
              <Link to={admin ? "/admin/orders" : "/"} className="back-link">
                {admin ? "Back to order queue" : "Continue browsing ↗"}
              </Link>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
