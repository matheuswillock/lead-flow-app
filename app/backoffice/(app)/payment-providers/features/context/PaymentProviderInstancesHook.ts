import { useContext } from "react"
import { PaymentProviderInstancesContext } from "./PaymentProviderInstancesContext"

export function usePaymentProviderInstances() {
  const context = useContext(PaymentProviderInstancesContext)
  if (!context) throw new Error("usePaymentProviderInstances requer o provider")
  return context
}
