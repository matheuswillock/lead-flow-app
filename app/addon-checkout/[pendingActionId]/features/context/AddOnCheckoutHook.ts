import { useContext } from "react";
import { AddOnCheckoutContext } from "./AddOnCheckoutContext";

export function useAddOnCheckout() {
  const context = useContext(AddOnCheckoutContext);
  if (!context) {
    throw new Error("useAddOnCheckout must be used within AddOnCheckoutProvider");
  }
  return context;
}
