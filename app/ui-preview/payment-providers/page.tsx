import { PaymentProviderPreviewProvider } from "./features/context/PaymentProviderPreviewContext"
import { PaymentProviderPreviewContainer } from "./features/container/PaymentProviderPreviewContainer"

export default function PaymentProvidersUiPreview() {
  return (
    <PaymentProviderPreviewProvider>
      <PaymentProviderPreviewContainer />
    </PaymentProviderPreviewProvider>
  )
}
