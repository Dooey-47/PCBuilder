import { useEffect, useState } from "react";
import { api } from "./api.js";
import { AuthContext } from "./auth-context.js";

export default function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, loading: true, error: "" });
  useEffect(() => {
    let active = true;
    api("/auth/session")
      .then(({ user }) => {
        if (active) setState({ user, loading: false, error: "" });
      })
      .catch((error) => {
        if (active)
          setState({ user: null, loading: false, error: error.message });
      });
    return () => {
      active = false;
    };
  }, []);
  const setUser = (user) => setState({ user, loading: false, error: "" });
  return (
    <AuthContext.Provider value={{ ...state, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
