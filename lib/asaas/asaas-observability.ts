import * as Sentry from "@sentry/nextjs"
import type { AsaasAccountId } from "./asaas-account"

export type AsaasEntityIdPrefix = "cus" | "sub" | "pay"

const ENTITY_ID_PATTERN = /\/(cus|sub|pay)_[A-Za-z0-9]+/

/**
 * Extrai o prefixo de ID Asaas (`cus_`/`sub_`/`pay_`) do endpoint chamado,
 * para telemetria (E7, T-30.23). `null` quando o endpoint não referencia
 * uma entidade específica (ex.: listagens paginadas).
 */
export function extractAsaasEntityIdPrefix(endpoint: string): AsaasEntityIdPrefix | null {
  const match = endpoint.match(ENTITY_ID_PATTERN)
  return match ? (match[1] as AsaasEntityIdPrefix) : null
}

/**
 * E7 (X3): toda chamada via `createAsaasClient` carrega a tag de conta —
 * aqui como breadcrumb, para não depender de `Sentry.withScope` (que não
 * propagaria de forma confiável através de `await` em versões antigas do
 * SDK). O breadcrumb acompanha qualquer evento capturado depois dele na
 * mesma requisição, inclusive os que a própria app já emite em call-sites
 * de mais alto nível.
 */
export function recordAsaasRequestBreadcrumb(input: {
  asaasAccount: AsaasAccountId
  entityIdPrefix: AsaasEntityIdPrefix | null
  endpoint: string
}): void {
  Sentry.addBreadcrumb({
    category: "asaas",
    message: "asaas-request",
    level: "info",
    data: {
      asaasAccount: input.asaasAccount,
      entityIdPrefix: input.entityIdPrefix,
      endpoint: input.endpoint,
    },
  })
}

/**
 * E7 (X3, T-30.23): 404 num recurso com prefixo de ID Asaas (cus_/sub_/
 * pay_) na conta `legacy` é sintoma de ponteiro morto pós-cutover — a
 * auditoria (C14/C28) mostrou self-heal reescrevendo `asaasCustomerId` em
 * silêncio quando isso acontece. Fingerprint dedicado para não se
 * misturar com 404 genérico de qualquer outra integração.
 */
export function reportAsaasLegacy404(input: {
  entityIdPrefix: AsaasEntityIdPrefix
  endpoint: string
}): void {
  Sentry.captureMessage(
    `[AsaasClient] 404 em recurso ${input.entityIdPrefix}_ na conta legacy (ponteiro possivelmente morto)`,
    {
      level: "warning",
      tags: {
        asaasAccount: "legacy",
        asaasEntityIdPrefix: input.entityIdPrefix,
        alertType: "asaas-legacy-404",
      },
      fingerprint: ["asaas-legacy-404", input.entityIdPrefix],
      extra: { endpoint: input.endpoint },
    }
  )
}
