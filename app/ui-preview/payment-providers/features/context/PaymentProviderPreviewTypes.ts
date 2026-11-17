import type { ICardConfigService } from "@/app/backoffice/(app)/payment-providers/features/card-config/ICardConfigService"
import type { PaymentProviderInstancesContextValue } from "@/app/backoffice/(app)/payment-providers/features/context/PaymentProviderInstancesTypes"

export interface PaymentProviderPreviewState {
  cardConfigService: ICardConfigService
  instancesContext: PaymentProviderInstancesContextValue
  notice: string
}

export type PaymentProviderPreviewContextValue = PaymentProviderPreviewState
