import { PaymentProviderInstancesProvider } from "./features/context/PaymentProviderInstancesContext"
import { PaymentProviderInstancesContainer } from "./features/container/PaymentProviderInstancesContainer"

export default function PaymentProvidersPage() {
  return <PaymentProviderInstancesProvider><PaymentProviderInstancesContainer /></PaymentProviderInstancesProvider>
}
