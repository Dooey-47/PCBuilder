import { createContext, useContext } from "react";
export const ShopContext = createContext(null);
export const useShop = () => useContext(ShopContext);
