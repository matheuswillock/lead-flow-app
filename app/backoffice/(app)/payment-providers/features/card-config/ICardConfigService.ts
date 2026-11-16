export type CardConfigEnvironment = "DEV" | "PRODUCTION"
export type PaymentProvider = "ASAAS" | "ABACATE_PAY"

export type ProviderVariable = {
  name: string
  visibility: "PUBLIC" | "SECRET"
  configured: boolean
  value?: string
}

export type ProviderVariablesConfig = {
  provider: PaymentProvider
  environment: CardConfigEnvironment
  revision: number
  variables: ProviderVariable[]
}

export interface AbacateCardConfig {
  environment: CardConfigEnvironment
  cardEnabled: boolean
  publicKey?: string | null
  revision: number
}

export interface ICardConfigService {
  /** Lista a configuração de cartão do Abacate Pay no ambiente (null quando o provider não existe nele). */
  getAbacateCardConfig(environment: CardConfigEnvironment): Promise<AbacateCardConfig | null>
  setCardEnabled(
    environment: CardConfigEnvironment,
    cardEnabled: boolean,
    expectedRevision: number
  ): Promise<AbacateCardConfig>
  setPublicKey?(environment: CardConfigEnvironment, publicKey: string | null, expectedRevision: number): Promise<AbacateCardConfig>
  getProviderConfigs?(environment: CardConfigEnvironment): Promise<ProviderVariablesConfig[]>
  setProviderVariables?(
    provider: PaymentProvider,
    environment: CardConfigEnvironment,
    variables: Array<{ name: string; visibility: "PUBLIC" | "SECRET"; value?: string }>,
    expectedRevision: number,
  ): Promise<ProviderVariablesConfig>
}
