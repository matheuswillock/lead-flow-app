import type { AsaasAccountMigrationStatus } from "@prisma/client"

/**
 * Máquina de estados do ledger de migração de conta Asaas — 30 — Migração
 * de Conta (execução) E3 (§9.4). Fonte única de verdade sobre quais
 * transições são legítimas; `AsaasAccountMigrationRepository.transition`
 * recusa qualquer par fora deste mapa.
 *
 * Invariante 1 (inegociável): de `subscription_created` só se avança para
 * `legacy_deactivated` com a assinatura nova confirmada — o legado nunca é
 * desativado antes disso. Por isso não existe aresta `pending ->
 * legacy_deactivated` nem qualquer atalho pulando `customer_created`/
 * `subscription_created`.
 */
export const ASAAS_ACCOUNT_MIGRATION_TRANSITIONS: Record<
  AsaasAccountMigrationStatus,
  AsaasAccountMigrationStatus[]
> = {
  pending: ["customer_created", "failed"],
  customer_created: ["subscription_created", "requires_card_reauth", "failed"],
  subscription_created: ["legacy_deactivated", "failed"],
  legacy_deactivated: ["done"],
  requires_card_reauth: ["subscription_created"],
  done: [],
  failed: ["pending"],
}

export class InvalidAsaasAccountMigrationTransitionError extends Error {
  constructor(
    readonly fromStatus: AsaasAccountMigrationStatus,
    readonly toStatus: AsaasAccountMigrationStatus,
    readonly legacyCustomerId: string
  ) {
    super(
      `Transição inválida no ledger de migração Asaas (legacyCustomerId=${legacyCustomerId}): "${fromStatus}" -> "${toStatus}" não é permitida (§9.4)`
    )
    this.name = "InvalidAsaasAccountMigrationTransitionError"
  }
}

export function isValidAsaasAccountMigrationTransition(
  fromStatus: AsaasAccountMigrationStatus,
  toStatus: AsaasAccountMigrationStatus
): boolean {
  return ASAAS_ACCOUNT_MIGRATION_TRANSITIONS[fromStatus].includes(toStatus)
}
