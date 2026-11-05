export type CardConfigEnvironment = "DEV" | "PRODUCTION"

export interface AbacateCardConfig {
  environment: CardConfigEnvironment
  cardEnabled: boolean
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
}
