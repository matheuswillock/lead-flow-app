import type { PaymentProviderPreviewState } from "../context/PaymentProviderPreviewTypes"

export interface IPaymentProviderPreviewService {
  getState: () => PaymentProviderPreviewState
}
