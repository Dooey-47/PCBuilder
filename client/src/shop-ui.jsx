import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth-context.js";
import { useShop } from "./shop-context.js";
import { money } from "./format.js";
export function Notice({ children, error = false }) {
  return (
    <div
      className={`notice ${error ? "notice-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function AddToCart({ product }) {
  const { user } = useAuth();
  const shop = useShop();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function add() {
    if (!user) return navigate("/login");
    setMessage("");
    setError("");
    try {
      await shop.add(product.id);
      setMessage("Added to your cart.");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="add-to-cart">
      <button
        className="button button-full"
        disabled={!product.stock || shop?.pending}
        onClick={add}
      >
        {!product.stock
          ? "Out of stock"
          : user
            ? "Add to cart"
            : "Sign in to add"}
        <span aria-hidden="true">+</span>
      </button>
      {message && <small role="status">{message}</small>}
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
export function Totals({ data }) {
  return (
    <dl className="order-totals">
      <div>
        <dt>Subtotal</dt>
        <dd>{money(data.subtotal)}</dd>
      </div>
      <div>
        <dt>Delivery</dt>
        <dd>{money(data.shippingFee)}</dd>
      </div>
      <div className="grand-total">
        <dt>Total</dt>
        <dd>{money(data.total)}</dd>
      </div>
    </dl>
  );
}
