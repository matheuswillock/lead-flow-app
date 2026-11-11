import { PaymentProviderInstancesProvider } from "./features/context/PaymentProviderInstancesContext"
import { PaymentProviderInstancesContainer } from "./features/container/PaymentProviderInstancesContainer"
import { CardConfigProvider } from "./features/card-config/CardConfigContext"
import { CardConfigService } from "./features/card-config/CardConfigService"

const cardConfigService = new CardConfigService()

export default function PaymentProvidersPage() {
  return (
    <PaymentProviderInstancesProvider>
      <CardConfigProvider cardConfigService={cardConfigService}>
        <PaymentProviderInstancesContainer />
      </CardConfigProvider>
    </PaymentProviderInstancesProvider>
  )
}
