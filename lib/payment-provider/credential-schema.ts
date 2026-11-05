import type { PaymentProviderEnvironment, PaymentProviderKey } from "./types"

export type ProviderCredentialDescriptor = {
  readonly required: boolean
  readonly hint: string
}

export function getCredentialDescriptors(
  provider: PaymentProviderKey,
  environment: PaymentProviderEnvironment,
): Readonly<Record<string, ProviderCredentialDescriptor>> {
  if (provider === "ASAAS") {
    return {
      API_KEY: { required: true, hint: "Chave de API da conta Asaas" },
      WEBHOOK_TOKEN: { required: false, hint: "Token de validação do webhook" },
      WALLET_ID: { required: false, hint: "Identificador da carteira" },
    }
  }

  return {
    API_KEY: { required: true, hint: "Chave de API do Abacate Pay" },
    WEBHOOK_SECRET: { required: true, hint: "Segredo de validação do webhook" },
    WEBHOOK_SECRET_PREVIOUS: { required: false, hint: "Segredo anterior aceito durante a rotação" },
    PUBLIC_KEY: {
      required: environment === "DEV",
      hint: environment === "PRODUCTION" ? "Obrigatória para pagamentos com cartão" : "Chave pública da loja",
    },
  }
}
