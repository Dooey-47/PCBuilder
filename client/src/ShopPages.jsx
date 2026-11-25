import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api } from "./api.js";
import { useAuth } from "./auth-context.js";
import { useShop } from "./shop-context.js";
import useRemote from "./useRemote.js";
import { money } from "./format.js";
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
          alt={item.image.alt}
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
        <p>{money(item.unitPrice)} each</p>
        <small className={item.available ? "stock" : "field-error"}>
          {!item.active
            ? "No longer for sale"
            : item.available
              ? `${item.stock} in stock`
              : `Only ${item.stock} available; reduce the quantity or remove this item.`}
        </small>
      </div>
      <form
        onSubmit={quantity}
        className="quantity-form"
        key={`${item.productId}-${item.quantity}`}
      >
        <label htmlFor={`quantity-${item.productId}`}>Quantity</label>
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
          Update
        </button>
      </form>
      <div className="cart-item-total">
        <strong>{money(item.lineTotal)}</strong>
        <button className="text-button" disabled={pending} onClick={remove}>
          Remove
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
      <p className="eyebrow">A LITTLE CLOSER TO YOUR NEXT SETUP</p>
      <h1 className="page-title">Your cart.</h1>
      {loading ? (
        <Notice>Loading your cart…</Notice>
      ) : error ? (
        <Notice error>
          {error.message}{" "}
          <button
            className="text-button"
            onClick={() => refresh().catch((err) => setMessage(err.message))}
          >
            Retry
          </button>
        </Notice>
      ) : !cart?.items.length ? (
        <Notice>
          Your cart is empty. <Link to="/">Explore products ↗</Link>
        </Notice>
      ) : (
        <>
          <p className="muted">
            Prices and availability are checked again when you confirm. Items
            are not reserved.
          </p>
          {message && <Notice error>{message}</Notice>}
          <div className="checkout-grid">
            <section aria-label="Cart products">
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
              <h2>Order summary</h2>
              <Totals data={cart} />
              {cart.canCheckout ? (
                <Link className="button button-full" to="/checkout">
                  Continue to checkout ↗
                </Link>
              ) : (
                <Notice error>Update unavailable items before checkout.</Notice>
              )}
              <Link className="back-link" to="/">
                ← Continue browsing
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
      body: { ...fields, paymentMethod: "COD", cartToken: shop.cart.token },
    };
    storeAttempt(storageKey, value);
    setAttempt(value);
    await send(value);
  }
  return (
    <div className="shell page-section">
      <nav className="breadcrumbs">
        <Link to="/cart">Cart</Link>
        <span>/</span>
        <span>Checkout</span>
      </nav>
      <p className="eyebrow">THE FINAL DETAILS</p>
      <h1 className="page-title">Make it yours.</h1>
      {error && <Notice error>{error.message}</Notice>}
      {attempt && (
        <Notice>
          Your last checkout needs confirmation. Retry the same request to
          recover its order safely; it will not create a second order.
          <button
            className="button button-small retry-checkout"
            disabled={pending}
            onClick={() => send(attempt)}
          >
            {pending ? "Confirming…" : "Retry this checkout"}
          </button>
        </Notice>
      )}
      {shop.loading ? (
        <Notice>Loading checkout…</Notice>
      ) : shop.error ? (
        <Notice error>{shop.error.message}</Notice>
      ) : !shop.cart?.items.length ? (
        <Notice>
          {attempt ? (
            "Your cart may have been cleared by the previous checkout. Use the retry button above to retrieve its order."
          ) : (
            <>
              Your cart is empty. <Link to="/">Browse products</Link>
            </>
          )}
        </Notice>
      ) : (
        <div className="checkout-grid">
          <section className="form-card checkout-form">
            <h2>Delivery information</h2>
            <p className="muted">
              Required fields are marked *. Your delivery details are saved with
              this order.
            </p>
            <form onSubmit={submit}>
              <fieldset disabled={pending || Boolean(attempt)}>
                <div className="field">
                  <label htmlFor="recipientName">Recipient name *</label>
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
                  <label htmlFor="delivery-phone">Phone number *</label>
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
                  <label htmlFor="address">Full delivery address *</label>
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
                <h3 className="small-heading">Payment method</h3>
                <p className="cod-option">◉ Cash on delivery (COD)</p>
                <p className="form-hint">
                  Pay on delivery. No payment gateway or card details are
                  involved.
                </p>
                <button
                  className="button button-full"
                  disabled={!shop.cart.canCheckout}
                >
                  {pending ? "Placing order…" : "Confirm COD order"} ↗
                </button>
              </fieldset>
            </form>
          </section>
          <aside className="summary-card">
            <h2>Your order</h2>
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
                Some items are unavailable.{" "}
                <Link to="/cart">Review your cart</Link>
              </Notice>
            )}
            <p className="form-hint">
              Check the latest totals before confirming. Changes to stock or
              prices require another review.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

export function OrderReceipt() {
  const { id } = useParams();
  const { data, error, loading, refresh } = useRemote(`/orders/${id}`);
  return (
    <div className="shell page-section">
      <p className="eyebrow">YOUR ORDER DETAILS</p>
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
          <h1 className="page-title">Order received.</h1>
          <p className="muted">
            Thank you, {data.order.recipientName}. Your order is waiting for
            confirmation.
          </p>
          <div className="checkout-grid">
            <section>
              <div className="receipt-info">
                <h2>{data.order.reference}</h2>
                <p>
                  Order: <strong>{data.order.status}</strong> · Payment:{" "}
                  <strong>{data.order.paymentStatus}</strong> (COD)
                </p>
                <p>{new Date(data.order.createdAt).toLocaleString()}</p>
                <h3 className="small-heading">Delivery details</h3>
                <p>
                  {data.order.recipientName}
                  <br />
                  {data.order.phone}
                  <br />
                  {data.order.address}
                </p>
              </div>
              <ul className="receipt-items">
                {data.order.items.map((item) => (
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
            </section>
            <aside className="summary-card">
              <h2>Order total</h2>
              <Totals data={data.order} />
              <Link to="/" className="button button-full">
                Continue browsing ↗
              </Link>
              <Link className="back-link" to="/orders">
                View your orders
              </Link>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const { data, error, loading } = useRemote(`/orders?page=${page}`);
  return (
    <div className="shell page-section">
      <p className="eyebrow">YOUR PURCHASES</p>
      <h1 className="page-title">Your orders.</h1>
      {loading ? (
        <Notice>Loading orders…</Notice>
      ) : error ? (
        <Notice error>{error.message}</Notice>
      ) : !data.orders.length ? (
        <Notice>
          No orders on this page. <Link to="/">Explore products</Link>
        </Notice>
      ) : (
        <>
          <div className="table-scroll">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Placed</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/orders/${order.id}`}>{order.reference}</Link>
                    </td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>{order.status}</td>
                    <td>{money(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total > data.pageSize && (
            <nav className="pagination-row">
              <button
                className="button button-secondary"
                disabled={page <= 1}
                onClick={() => setParams({ page: String(page - 1) })}
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                className="button button-secondary"
                disabled={page * data.pageSize >= data.total}
                onClick={() => setParams({ page: String(page + 1) })}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
