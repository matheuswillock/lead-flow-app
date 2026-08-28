/**
 * Contrato de persistência das configurações de e-mail do time.
 *
 * A interface NÃO expõe `runInTransaction` nem `Prisma.TransactionClient` de
 * propósito: devolver o client transacional ao UseCase apenas mudaria o nome do
 * acoplamento (o regex de governança é case-sensitive em `prisma.` e não enxerga
 * `tx.`), mantendo a regra de atomicidade fora da camada que é dona dela. Cada
 * unidade de trabalho abaixo abre a própria transação dentro do repositório.
 */

/** Entrada de bloqueio de disparo: um dia isolado ou um intervalo fechado. */
export type BlockedDateRange =
  | { date: string }
  | { from: string; to: string }

/**
 * Espelha 1:1 as colunas de EmailTeamSettings consumidas pelo UseCase.
 * Tipado explicitamente (nunca `any`/`Record<string, unknown>`) porque um typo em
 * `resendDomainStatus` zeraria `resendDomainTrackingCapable` e sumiria com o CTA
 * de tracking na UI sem nenhum erro.
 *
 * `resendDomainConnectedAt` é `Date`, não `string`: o UseCase chama `.toISOString()`
 * e o optional chaining engoliria um `undefined` silenciosamente.
 */
export type EmailTeamSettingsRecord = {
  fromName: string
  fromEmail: string
  replyTo: string | null
  dispatchBlockedDates: BlockedDateRange[] | null
  dispatchTimeFrom: string | null
  dispatchTimeTo: string | null
  dispatchAllowedRoles: string[]
  templateCreateRoles: string[]
  templateApprovalRequired: boolean
  templateApprovalRoles: string[]
  blockedDispatchDays: number[]
  resendDomainId: string | null
  resendDomainName: string | null
  resendDomainStatus: string | null
  resendDomainRegion: string | null
  resendDomainConnectedAt: Date | null
  resendOpenTracking: boolean
  resendClickTracking: boolean
}

export type EmailTeamSenderRecord = {
  id: string
  name: string
  email: string
  replyTo: string | null
  isDefault: boolean
}

export type EmailTeamVariableRecord = {
  id: string
  key: string
  type: string
  defaultValue: string | null
  description: string | null
  isActive: boolean
}

/**
 * Trio lido dentro de uma única transação e devolvido bruto — a montagem do DTO
 * de resposta (que aplica defaults de exibição e resolve o From da campanha)
 * continua no UseCase, porque é regra de domínio e não de persistência.
 */
export type EmailTeamSettingsSnapshot = {
  settings: EmailTeamSettingsRecord | null
  senders: EmailTeamSenderRecord[]
  variables: EmailTeamVariableRecord[]
}

/** Payload de remetente já normalizado pelo UseCase (trim + lowercase). */
export type EmailSenderPayload = {
  name: string
  email: string
  replyTo: string | null
}

/**
 * Semântica de cada campo: `undefined` = não mexer; `null` = limpar.
 * Achatar os dois em um só faz o botão de limpar restrições não persistir — e
 * esses campos alimentam o gate real de disparo em `campaign-dispatch-guards`.
 */
export type DispatchPolicyPatch = {
  dispatchBlockedDates?: BlockedDateRange[] | null
  dispatchTimeFrom?: string | null
  dispatchTimeTo?: string | null
  dispatchAllowedRoles?: string[]
  templateCreateRoles?: string[]
  templateApprovalRequired?: boolean
  templateApprovalRoles?: string[]
  blockedDispatchDays?: number[] | null
  /** From da plataforma, usado APENAS quando a linha ainda não existe. */
  createDefaults: { fromName: string; fromEmail: string }
}

export type ConnectedDomainInput = {
  domainId: string
  domainName: string
  status: string
  region: string
  connectedAt: Date
  openTracking: boolean
  clickTracking: boolean
  /**
   * != null ⇒ sobrescreve fromEmail/fromName com o endereço de entrega do domínio.
   * O UseCase só preenche quando o time ainda não tem nenhum remetente cadastrado;
   * caso contrário o From escolhido pelo time seria silenciosamente substituído.
   */
  deliveryFrom: { fromName: string; fromEmail: string } | null
  createDefaults: { fromName: string; fromEmail: string }
}

export interface IEmailTeamSettingsRepository {
  // --- Leituras simples (sem transação) ---
  findSettings(teamId: string): Promise<EmailTeamSettingsRecord | null>
  /**
   * `orderBy` fixo [{isDefault:desc},{createdAt:asc},{name:asc}]: é ele que decide
   * quem herda o papel de padrão quando o time fica sem nenhum default.
   */
  listSenders(teamId: string): Promise<EmailTeamSenderRecord[]>
  countSenders(teamId: string): Promise<number>

  // --- Unidades de trabalho transacionais ---
  /** Leitura coerente de settings + senders + variables no mesmo snapshot. */
  findSettingsSnapshot(teamId: string): Promise<EmailTeamSettingsSnapshot>
  /** Lê o registro atual, faz o upsert e relê tudo no MESMO commit. */
  saveDispatchPolicy(
    teamId: string,
    patch: DispatchPolicyPatch
  ): Promise<EmailTeamSettingsSnapshot>
  createSender(teamId: string, payload: EmailSenderPayload): Promise<EmailTeamSenderRecord>
  /** `null` = remetente inexistente no time (transação já revertida). */
  updateSender(
    teamId: string,
    senderId: string,
    payload: EmailSenderPayload
  ): Promise<EmailTeamSenderRecord | null>
  /** `false` = remetente inexistente no time. */
  deleteSender(teamId: string, senderId: string): Promise<boolean>
  /** `null` = remetente inexistente no time. */
  promoteSenderToDefault(
    teamId: string,
    senderId: string
  ): Promise<EmailTeamSettingsSnapshot | null>

  // --- Escritas de domínio Resend (SEM transação: preserva a ordem Resend → DB) ---
  saveConnectedDomain(teamId: string, input: ConnectedDomainInput): Promise<void>
  /**
   * Limpa os campos resend* E, opcionalmente, reseta o From.
   * Deliberadamente separado de `EmailTeamDomainEventRepository.clearDomainSettings`,
   * que não toca em fromEmail/fromName: reusar aquele método deixaria o From
   * apontando para um domínio já removido do Resend.
   */
  clearConnectedDomain(
    teamId: string,
    resetFrom: { fromName: string; fromEmail: string } | null
  ): Promise<void>
}
