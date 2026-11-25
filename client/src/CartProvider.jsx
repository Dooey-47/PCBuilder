import { useEffect, useState } from "react";
import { api } from "./api.js";
import { useAuth } from "./auth-context.js";
import { ShopContext } from "./shop-context.js";

export default function CartProvider({ children }) {
  const { user } = useAuth();
  const ownerId = user?.id;
  const [state, setState] = useState(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    api("/cart")
      .then(({ cart }) => {
        if (active) setState({ ownerId, cart });
      })
      .catch((error) => {
        if (active) setState({ ownerId, error });
      });
    return () => {
      active = false;
    };
  }, [ownerId]);
  const current = ownerId && state?.ownerId === ownerId ? state : null;
  async function refresh() {
    const { cart } = await api("/cart");
    setState({ ownerId, cart });
    return cart;
  }
  async function mutate(productId, quantity) {
    setPending(true);
    try {
      const result = await api(
        `/cart/items/${productId}`,
        quantity === null
          ? { method: "DELETE" }
          : { method: "PUT", body: { quantity } },
      );
      setState({ ownerId, cart: result.cart });
      return result.cart;
    } finally {
      setPending(false);
    }
  }
  async function add(productId) {
    setPending(true);
    try {
      const { cart } = await api("/cart");
      const quantity =
        (cart.items.find((item) => item.productId === productId)?.quantity ??
          0) + 1;
      const result = await api(`/cart/items/${productId}`, {
        method: "PUT",
        body: { quantity },
      });
      setState({ ownerId, cart: result.cart });
    } finally {
      setPending(false);
    }
  }
  return (
    <ShopContext.Provider
      value={{
        cart: current?.cart,
        error: current?.error,
        loading: Boolean(ownerId && !current),
        pending,
        refresh,
        mutate,
        add,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}
