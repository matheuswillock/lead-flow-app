import { isApiRequestError } from "@/lib/http/api-request-error"
import type {
  AbacateCardConfig,
  CardConfigEnvironment,
  ICardConfigService,
} from "./ICardConfigService"

export type CardToggleOutcome =
  | { status: "saved"; config: AbacateCardConfig }
  | { status: "conflict"; config: AbacateCardConfig | null }
  | { status: "forbidden" }
  | { status: "error"; message: string }

const FALLBACK_ERROR = "Não foi possível salvar a configuração de cartão."

/**
 * Aplica a troca de `cardEnabled` e traduz a falha em um desfecho que a UI sabe
 * mostrar. No conflito de revisão recarrega o registro, para a próxima tentativa
 * já usar a `revision` mais recente.
 */
export async function runCardToggle(
  service: ICardConfigService,
  environment: CardConfigEnvironment,
  cardEnabled: boolean,
  expectedRevision: number
): Promise<CardToggleOutcome> {
  try {
    const config = await service.setCardEnabled(environment, cardEnabled, expectedRevision)
    return { status: "saved", config }
  } catch (error) {
    const status = isApiRequestError(error) ? error.status : undefined
    if (status === 403) return { status: "forbidden" }
    if (status === 409) return { status: "conflict", config: await reloadQuietly(service, environment) }
    const message = isApiRequestError(error) && error.message ? error.message : FALLBACK_ERROR
    return { status: "error", message }
  }
}

async function reloadQuietly(
  service: ICardConfigService,
  environment: CardConfigEnvironment
): Promise<AbacateCardConfig | null> {
  try {
    return await service.getAbacateCardConfig(environment)
  } catch {
    return null
  }
}
