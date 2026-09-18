import type { AsaasAccountMigration, AsaasAccountMigrationStatus } from "@prisma/client"

/** Snapshot do legado gravado na criação da linha do ledger (M5.3, §9.3). */
export type AsaasAccountMigrationSnapshotInput = {
  profileId: string
  clientName: string
  clientEmail: string
  legacyCustomerId: string
  legacySubscriptionId?: string | null
  billingType?: string | null
  cycle?: string | null
  value?: number | null
  nextDueDate?: Date | null
}

/** Payload de uma transição de estado (E5 é quem chama; E3 só entrega o contrato). */
export type AsaasAccountMigrationTransitionInput = {
  legacyCustomerId: string
  toStatus: AsaasAccountMigrationStatus
  primaryCustomerId?: string | null
  primarySubscriptionId?: string | null
  lastError?: string | null
  anomalyNotes?: string | null
  migratedAt?: Date | null
}

export interface IAsaasAccountMigrationRepository {
  /**
   * Idempotente por `legacyCustomerId` (`@unique` no schema, DA2/§9.3):
   * cria a linha na primeira chamada; chamadas seguintes com o mesmo
   * `legacyCustomerId` são no-op (nunca reescreve o snapshot já gravado —
   * a trigger S4 bloquearia mesmo que tentasse).
   */
  upsertSnapshot(snapshot: AsaasAccountMigrationSnapshotInput): Promise<AsaasAccountMigration>

  findByLegacyCustomerId(legacyCustomerId: string): Promise<AsaasAccountMigration | null>

  /**
   * Aplica uma transição de estado validada contra
   * `ASAAS_ACCOUNT_MIGRATION_TRANSITIONS` (§9.4). Lança
   * `InvalidAsaasAccountMigrationTransitionError` para qualquer par fora do
   * mapa — nunca escreve o estado inválido no banco.
   */
  transition(input: AsaasAccountMigrationTransitionInput): Promise<AsaasAccountMigration>

  countAll(): Promise<number>

  /**
   * E7 (X3, T-30.25): linhas presas fora dos estados terminais
   * (`done`/`failed`/`requires_card_reauth`) há mais que `olderThan` —
   * sintoma de migração travada no meio (ex.: processo morreu entre
   * `customer_created` e `subscription_created`) sem que ninguém tenha
   * percebido. `failed` e `requires_card_reauth` são estados "parados"
   * esperados (aguardam retry manual/ação do cliente) — não entram aqui.
   */
  listNonTerminalStaleSince(olderThan: Date): Promise<AsaasAccountMigration[]>

  /**
   * E2 (M0.3/M0.4): marca `notifications_disabled = true` sem tocar
   * `status`/`attempt_count` — não é uma transição de estado (§9.4), é só
   * o registro de que o silenciamento já rodou para este customer. No-op
   * (retorna `false`) quando a linha ainda não existe — o silenciamento
   * roda antes do populate do ledger (E4), então a linha normalmente NÃO
   * existe ainda; o registro de verdade nesse caso é
   * `corretor_studio_asaas_notification_backfill` (M0.4).
   */
  markNotificationsDisabled(legacyCustomerId: string): Promise<boolean>
}
