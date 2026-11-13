import type { ICardConfigService } from "@/app/backoffice/(app)/payment-providers/features/card-config/ICardConfigService"
import type { PaymentProviderInstancesContextValue } from "@/app/backoffice/(app)/payment-providers/features/context/PaymentProviderInstancesTypes"
import type { IPaymentProviderPreviewService } from "./IPaymentProviderPreviewService"

const cardConfigService: ICardConfigService = {
  getAbacateCardConfig: async () => null,
  setCardEnabled: async (environment, cardEnabled, expectedRevision) => ({
    environment,
    cardEnabled,
    revision: expectedRevision + 1,
  }),
}

const instancesContext: PaymentProviderInstancesContextValue = {
  instances: [
    {
      id: "preview-abacate-dev",
      provider: "ABACATE_PAY",
      environment: "DEV",
      displayName: "Abacate Pay",
      logoUrl: null,
      logoAltText: null,
      externalAccountContext: "abacate-pay",
      enabled: true,
      rolloutState: "ACTIVE",
      isDefault: true,
      healthStatus: "HEALTHY",
      lastHealthCheckAt: null,
      isSelectable: true,
      capabilities: ["PIX", "CARD"],
      credentials: {
        API_KEY: { isSet: true, last4: "4242", fingerprint: "preview-dev" },
        WEBHOOK_SECRET: { isSet: true, last4: "0192", fingerprint: "preview-dev" },
      },
    },
    {
      id: "preview-abacate-production",
      provider: "ABACATE_PAY",
      environment: "PRODUCTION",
      displayName: "Abacate Pay",
      logoUrl: null,
      logoAltText: null,
      externalAccountContext: "abacate-pay",
      enabled: true,
      rolloutState: "ACTIVE",
      isDefault: true,
      healthStatus: "HEALTHY",
      lastHealthCheckAt: new Date("2026-11-12T18:30:00-03:00").toISOString(),
      isSelectable: true,
      capabilities: ["PIX", "CARD"],
      credentials: {
        API_KEY: { isSet: true, last4: "8888", fingerprint: "preview-production" },
        WEBHOOK_SECRET: { isSet: true, last4: "2731", fingerprint: "preview-production" },
        PUBLIC_KEY: { isSet: true, last4: "1212", fingerprint: "preview-production" },
      },
    },
  ],
  loading: false,
  saving: false,
  error: null,
  refresh: async () => {},
  create: async () => {},
  update: async () => {},
  checkHealth: async () => {},
}

export class PaymentProviderPreviewService implements IPaymentProviderPreviewService {
  getState() {
    return {
      cardConfigService,
      instancesContext,
      notice: "Dados simulados: esta prévia não salva credenciais e não representa contas reais.",
    }
  }
}

export const paymentProviderPreviewService = new PaymentProviderPreviewService()
