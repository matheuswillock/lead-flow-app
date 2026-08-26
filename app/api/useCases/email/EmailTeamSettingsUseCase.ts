import { Output } from "@/lib/output"
import { emailTeamSettingsRepository } from "@/app/api/infra/data/repositories/emailTeamSettings/EmailTeamSettingsRepository"
import type {
  BlockedDateRange,
  EmailTeamSenderRecord,
  EmailTeamSettingsRecord,
  EmailTeamVariableRecord,
  IEmailTeamSettingsRepository,
} from "@/app/api/infra/data/repositories/emailTeamSettings/IEmailTeamSettingsRepository"
import { assertResend } from "@/lib/email"
import { RESEND_TRACKING_POLICY } from "@/lib/email/resend-domain-reconcile"
import {
  isTrackingSubdomainAlreadyExists,
  mapResendDomainError,
} from "@/lib/email/map-resend-domain-error"
import {
  assertSenderEmailIsAllowed,
  buildDeliveryFromEmail,
  isPlatformDefaultFromEmail,
  PLATFORM_FROM_EMAIL,
  PLATFORM_FROM_NAME,
  resolveCampaignFrom,
} from "@/lib/email/resolve-campaign-from"
import {
  emailTeamDomainEventRepository,
  type IEmailTeamDomainEventRepository,
} from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"
import {
  getResendDomainDispatchWarnings,
  isResendDomainTrackingCapable,
  resendDomainTrackingInputFromSettings,
} from "@/lib/email/campaign-dispatch-guards"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"

// A definição vive na camada de persistência (é o formato gravado na coluna Json);
// reexportada aqui porque os consumidores históricos importam deste módulo.
export type { BlockedDateRange }

export type ResendDomainStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed"
  | "temporary_failure"
  | "partially_verified"
  | "partially_failed"

export interface UpdateEmailSettingsInput {
  dispatchBlockedDates?: BlockedDateRange[] | null
  dispatchTimeFrom?: string | null
  dispatchTimeTo?: string | null
  dispatchAllowedRoles?: string[]
  templateCreateRoles?: string[]
  templateApprovalRequired?: boolean
  templateApprovalRoles?: string[]
  blockedDispatchDays?: number[] | null
}

export interface UpsertEmailSenderInput {
  name: string
  email: string
  replyTo?: string | null
}

const VALID_ROLES = ["manager", "backoffice", "operator"] as const
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const DEFAULT_DOMAIN_REGION = "sa-east-1"
const DEFAULT_TRACKING_SUBDOMAIN = "links"

/**
 * Sem `clickTracking` de propósito: o rastreio de cliques do Resend fica sempre
 * desligado. Ele reescreve os links do e-mail para o subdomínio de tracking, o
 * que faz provedores marcarem a mensagem como suspeita, e o clique já é medido
 * no first-party do formulário. Não é uma escolha do time.
 */
export type ConfigureDomainTrackingInput = {
  trackingSubdomain: string
  openTracking: boolean
}

const TRACKING_SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

function normalizeTrackingSubdomain(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  if (!TRACKING_SUBDOMAIN_RE.test(normalized)) return null
  return normalized
}

/** Valores de exibição quando o time ainda não tem linha de configuração. */
const DEFAULTS = {
  fromName: PLATFORM_FROM_NAME,
  fromEmail: PLATFORM_FROM_EMAIL,
  replyTo: null,
  dispatchBlockedDates: null,
  dispatchTimeFrom: null,
  dispatchTimeTo: null,
  dispatchAllowedRoles: ["manager", "backoffice"],
  templateCreateRoles: ["manager", "backoffice"],
  templateApprovalRequired: false,
  templateApprovalRoles: ["manager", "backoffice"],
  blockedDispatchDays: [],
  resendDomainId: null,
  resendDomainName: null,
  resendDomainStatus: null,
  resendDomainRegion: null,
  resendDomainConnectedAt: null,
  resendOpenTracking: false,
  resendClickTracking: false,
}

function validateRoles(roles: string[]): string | null {
  const invalid = roles.filter((r) => !VALID_ROLES.includes(r as (typeof VALID_ROLES)[number]))
  if (invalid.length > 0) return `Roles inválidas: ${invalid.join(", ")}`
  return null
}

function validateBlockedDates(entries: BlockedDateRange[]): string | null {
  for (const entry of entries) {
    if ("date" in entry) {
      if (!DATE_RE.test(entry.date)) return `Data inválida: ${entry.date}. Use o formato YYYY-MM-DD`
    } else {
      if (!DATE_RE.test(entry.from)) return `Data inválida: ${entry.from}. Use o formato YYYY-MM-DD`
      if (!DATE_RE.test(entry.to)) return `Data inválida: ${entry.to}. Use o formato YYYY-MM-DD`
      if (entry.from > entry.to) return "Intervalo inválido: 'from' deve ser anterior a 'to'"
    }
  }
  return null
}

function validateBlockedDays(days: number[]): string | null {
  const invalid = days.filter((day) => !Number.isInteger(day) || day < 1 || day > 31)
  if (invalid.length > 0) return `Dias bloqueados inválidos: ${invalid.join(", ")}`
  return null
}

function validateSenderInput(input: UpsertEmailSenderInput): string | null {
  if (!input.name.trim()) return "Nome do remetente não pode ser vazio"
  if (!input.email.trim()) return "Email do remetente não pode ser vazio"
  return null
}

function validateSenderEmailForDomain(
  email: string,
  domainName: string | null | undefined,
  domainStatus: string | null | undefined
): string | null {
  const check = assertSenderEmailIsAllowed({ email, domainName, domainStatus })
  return check.ok ? null : check.message
}

function normalizeSenderPayload(input: UpsertEmailSenderInput) {
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    replyTo: input.replyTo?.trim() ? input.replyTo.trim().toLowerCase() : null,
  }
}

export type EmailTeamSettingsDependencies = {
  settingsRepo?: IEmailTeamSettingsRepository
  resendFactory?: () => ReturnType<typeof assertResend>
  domainEvents?: IEmailTeamDomainEventRepository
}

export class EmailTeamSettingsUseCase {
  // Default singleton: existem 10 call sites fazendo `new EmailTeamSettingsUseCase()`
  // (8 rotas de produto, o UseCase de backoffice em field initializer e o teste).
  // Parâmetro obrigatório quebraria todos sem ganho nenhum.
  private readonly settingsRepo: IEmailTeamSettingsRepository
  private readonly resendFactory: () => ReturnType<typeof assertResend>
  private readonly domainEvents: IEmailTeamDomainEventRepository

  /**
   * Dependências por objeto nomeado, não por posição: quem só quer injetar o
   * `resendFactory` não precisa repetir o repositório antes dele.
   *
   * `resendFactory` é costura de teste, não indireção decorativa: sem ela o
   * único jeito de exercitar `connectDomain` seria `mock.module` no
   * `@/lib/email`, que vaza para todos os arquivos da mesma execução de
   * `bun test`.
   */
  constructor(dependencies: EmailTeamSettingsDependencies = {}) {
    this.settingsRepo = dependencies.settingsRepo ?? emailTeamSettingsRepository
    this.resendFactory = dependencies.resendFactory ?? assertResend
    this.domainEvents = dependencies.domainEvents ?? emailTeamDomainEventRepository
  }

  private composeResult(
    settings: EmailTeamSettingsRecord | null,
    senders: EmailTeamSenderRecord[],
    globalVariables: EmailTeamVariableRecord[] = [],
    domainEvents: Array<{
      id: string
      type: string
      occurredAt: string
      metadata: Record<string, unknown> | null
    }> = []
  ) {
    const defaultSender = senders.find((sender) => sender.isDefault) ?? null
    const resolvedFrom = resolveCampaignFrom({
      domainName: settings?.resendDomainName,
      defaultSender: defaultSender
        ? { name: defaultSender.name, email: defaultSender.email }
        : null,
      legacyFromName: settings?.fromName,
      legacyFromEmail: settings?.fromEmail,
    })

    return {
      fromName: resolvedFrom.fromName,
      fromEmail: resolvedFrom.fromEmail,
      replyTo: settings?.replyTo ?? DEFAULTS.replyTo,
      dispatchBlockedDates: settings?.dispatchBlockedDates ?? DEFAULTS.dispatchBlockedDates,
      dispatchTimeFrom: settings?.dispatchTimeFrom ?? DEFAULTS.dispatchTimeFrom,
      dispatchTimeTo: settings?.dispatchTimeTo ?? DEFAULTS.dispatchTimeTo,
      dispatchAllowedRoles: settings?.dispatchAllowedRoles ?? DEFAULTS.dispatchAllowedRoles,
      templateCreateRoles: settings?.templateCreateRoles ?? DEFAULTS.templateCreateRoles,
      templateApprovalRequired: settings?.templateApprovalRequired ?? DEFAULTS.templateApprovalRequired,
      templateApprovalRoles: settings?.templateApprovalRoles ?? DEFAULTS.templateApprovalRoles,
      blockedDispatchDays: settings?.blockedDispatchDays ?? DEFAULTS.blockedDispatchDays,
      resendDomainId: settings?.resendDomainId ?? DEFAULTS.resendDomainId,
      resendDomainName: settings?.resendDomainName ?? DEFAULTS.resendDomainName,
      resendDomainStatus: settings?.resendDomainStatus ?? DEFAULTS.resendDomainStatus,
      resendDomainRegion: settings?.resendDomainRegion ?? DEFAULTS.resendDomainRegion,
      resendDomainConnectedAt: settings?.resendDomainConnectedAt?.toISOString() ?? null,
      resendOpenTracking: settings?.resendOpenTracking ?? DEFAULTS.resendOpenTracking,
      resendClickTracking: settings?.resendClickTracking ?? DEFAULTS.resendClickTracking,
      resendDomainTrackingCapable: isResendDomainTrackingCapable(settings?.resendDomainStatus),
      resendDomainDispatchWarnings: getResendDomainDispatchWarnings(
        resendDomainTrackingInputFromSettings(settings)
      ),
      domainEvents,
      senders,
      defaultSenderId: defaultSender?.id ?? null,
      globalVariables,
    }
  }

  async get(ctx: TeamContext): Promise<Output> {
    try {
      const rawEvents = await this.domainEvents.listEvents(ctx.teamId)
      const domainEvents = rawEvents.map((event) => ({
        id: event.id,
        type: event.type,
        occurredAt: event.occurredAt.toISOString(),
        metadata: event.metadata,
      }))
      // O histórico de eventos fica FORA do snapshot: é uma tabela append-only de
      // auditoria, não participa do invariante settings ↔ senders.
      const snapshot = await this.settingsRepo.findSettingsSnapshot(ctx.teamId)
      const result = this.composeResult(
        snapshot.settings,
        snapshot.senders,
        snapshot.variables,
        domainEvents
      )

      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][get]", error)
      return new Output(false, [], ["Erro ao buscar configurações de email"], null)
    }
  }

  async update(data: UpdateEmailSettingsInput, ctx: TeamContext): Promise<Output> {
    try {
      if (data.dispatchTimeFrom !== undefined && data.dispatchTimeFrom !== null && !TIME_RE.test(data.dispatchTimeFrom)) {
        return new Output(false, [], ["Horário de início inválido. Use o formato HH:mm"], null)
      }
      if (data.dispatchTimeTo !== undefined && data.dispatchTimeTo !== null && !TIME_RE.test(data.dispatchTimeTo)) {
        return new Output(false, [], ["Horário de fim inválido. Use o formato HH:mm"], null)
      }
      if (data.dispatchAllowedRoles !== undefined) {
        const err = validateRoles(data.dispatchAllowedRoles)
        if (err) return new Output(false, [], [err], null)
        if (data.dispatchAllowedRoles.length === 0) {
          return new Output(false, [], ["Pelo menos uma role deve ter permissão de disparo"], null)
        }
      }
      if (data.templateCreateRoles !== undefined) {
        const err = validateRoles(data.templateCreateRoles)
        if (err) return new Output(false, [], [err], null)
        if (data.templateCreateRoles.length === 0) {
          return new Output(false, [], ["Pelo menos uma role deve ter permissão de criar templates"], null)
        }
      }
      if (data.templateApprovalRoles !== undefined) {
        const err = validateRoles(data.templateApprovalRoles)
        if (err) return new Output(false, [], [err], null)
      }
      if (data.dispatchBlockedDates !== undefined && data.dispatchBlockedDates !== null) {
        const err = validateBlockedDates(data.dispatchBlockedDates)
        if (err) return new Output(false, [], [err], null)
      }
      if (data.blockedDispatchDays !== undefined && data.blockedDispatchDays !== null) {
        const err = validateBlockedDays(data.blockedDispatchDays)
        if (err) return new Output(false, [], [err], null)
      }
      if (data.templateApprovalRequired && data.templateApprovalRoles !== undefined && data.templateApprovalRoles.length === 0) {
        return new Output(false, [], ["Pelo menos uma role deve aprovar templates"], null)
      }

      // `data` é repassado inteiro: cada chave carrega a distinção
      // `undefined` (não mexer) / `null` (limpar), que o repositório traduz para
      // os dois "nulos" distintos de coluna Json.
      const snapshot = await this.settingsRepo.saveDispatchPolicy(ctx.teamId, {
        ...data,
        createDefaults: { fromName: DEFAULTS.fromName, fromEmail: DEFAULTS.fromEmail },
      })
      const result = this.composeResult(snapshot.settings, snapshot.senders, snapshot.variables)

      return new Output(true, ["Configurações salvas com sucesso"], [], result)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][update]", error)
      return new Output(false, [], ["Erro ao salvar configurações de email"], null)
    }
  }

  async listSenders(ctx: TeamContext): Promise<Output> {
    try {
      const senders = await this.settingsRepo.listSenders(ctx.teamId)
      return new Output(true, [], [], senders)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][listSenders]", error)
      return new Output(false, [], ["Erro ao buscar remetentes"], null)
    }
  }

  async createSender(input: UpsertEmailSenderInput, ctx: TeamContext): Promise<Output> {
    try {
      const validationError = validateSenderInput(input)
      if (validationError) return new Output(false, [], [validationError], null)

      // A guarda de domínio roda ANTES de qualquer escrita: um remetente fora de
      // um domínio verificado nunca chega a existir no banco.
      const settings = await this.settingsRepo.findSettings(ctx.teamId)
      const domainError = validateSenderEmailForDomain(
        input.email,
        settings?.resendDomainName,
        settings?.resendDomainStatus
      )
      if (domainError) return new Output(false, [], [domainError], null)

      const sender = await this.settingsRepo.createSender(
        ctx.teamId,
        normalizeSenderPayload(input)
      )

      return new Output(true, ["Remetente criado com sucesso"], [], sender)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][createSender]", error)
      return new Output(false, [], ["Erro ao criar remetente"], null)
    }
  }

  async updateSender(senderId: string, input: UpsertEmailSenderInput, ctx: TeamContext): Promise<Output> {
    try {
      const validationError = validateSenderInput(input)
      if (validationError) return new Output(false, [], [validationError], null)

      const settings = await this.settingsRepo.findSettings(ctx.teamId)
      const domainError = validateSenderEmailForDomain(
        input.email,
        settings?.resendDomainName,
        settings?.resendDomainStatus
      )
      if (domainError) return new Output(false, [], [domainError], null)

      // `null` significa "remetente não pertence a este time" — o repositório já
      // reverteu a transação nesse caminho.
      const sender = await this.settingsRepo.updateSender(
        ctx.teamId,
        senderId,
        normalizeSenderPayload(input)
      )
      if (!sender) {
        return new Output(false, [], ["Remetente não encontrado"], null)
      }

      return new Output(true, ["Remetente atualizado com sucesso"], [], sender)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][updateSender]", error)
      return new Output(false, [], ["Erro ao atualizar remetente"], null)
    }
  }

  async deleteSender(senderId: string, ctx: TeamContext): Promise<Output> {
    try {
      const deleted = await this.settingsRepo.deleteSender(ctx.teamId, senderId)
      if (!deleted) {
        return new Output(false, [], ["Remetente não encontrado"], null)
      }

      return new Output(true, ["Remetente removido com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][deleteSender]", error)
      return new Output(false, [], ["Erro ao remover remetente"], null)
    }
  }

  async setDefaultSender(senderId: string, ctx: TeamContext): Promise<Output> {
    try {
      const snapshot = await this.settingsRepo.promoteSenderToDefault(ctx.teamId, senderId)
      if (!snapshot) {
        return new Output(false, [], ["Remetente não encontrado"], null)
      }

      const result = this.composeResult(snapshot.settings, snapshot.senders, snapshot.variables)
      return new Output(true, ["Remetente padrão atualizado"], [], result)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][setDefaultSender]", error)
      return new Output(false, [], ["Erro ao definir remetente padrão"], null)
    }
  }

  async connectDomain(domainName: string, ctx: TeamContext): Promise<Output> {
    try {
      if (!domainName.trim() || domainName.length < 3) {
        return new Output(false, [], ["Nome de domínio inválido"], null)
      }

      const existing = await this.settingsRepo.findSettings(ctx.teamId)
      if (existing?.resendDomainId) {
        return new Output(
          false,
          [],
          ["Já existe um domínio conectado. Remova o domínio atual antes de conectar outro."],
          null
        )
      }

      const resend = this.resendFactory()
      const { data, error } = await resend.domains.create({
        name: domainName.trim(),
        region: DEFAULT_DOMAIN_REGION,
        customReturnPath: "bounce",
        openTracking: true,
        clickTracking: false,
        trackingSubdomain: DEFAULT_TRACKING_SUBDOMAIN,
      })
      if (error || !data) {
        console.error("[EmailTeamSettingsUseCase][connectDomain] Resend error", error)
        return new Output(
          false,
          [],
          [mapResendDomainError(error?.message, "connect", domainName.trim())],
          null
        )
      }

      // Click tracking fica desligado: ele reescreve todo href do template para
      // o subdomínio de tracking, e esse redirecionador é penalizado pelo Safe
      // Browsing ("link parece perigoso" no Gmail). O clique é medido no
      // first-party, pelo `cs_el` carimbado na URL do formulário. O
      // `trackingSubdomain` continua sendo criado porque o open tracking usa o
      // mesmo CNAME.
      //
      // O `create` acima já nasce com `clickTracking: false` — não há janela em
      // que o redirecionador exista. Este update é reforço, e o erro dele é
      // verificado: sem isso, uma falha aqui deixaria o provedor divergente do
      // que gravamos no banco e a operação ainda reportaria sucesso.
      const { error: trackingError } = await resend.domains.update({
        id: data.id,
        openTracking: true,
        clickTracking: false,
        trackingSubdomain: DEFAULT_TRACKING_SUBDOMAIN,
      })
      if (trackingError) {
        console.error(
          "[EmailTeamSettingsUseCase][connectDomain] Resend tracking error",
          trackingError
        )
        // Remove o domínio recém-criado antes de devolver o erro. Sem isso o
        // `create` acima deixa um domínio órfão no Resend que nós nunca
        // persistimos: a retentativa tenta criar o mesmo nome e trava para
        // sempre num erro de domínio já existente, sem caminho de saída pela
        // UI. Preferimos desfazer a deixar estado pendurado no provedor.
        const { error: cleanupError } = await resend.domains.remove(data.id)
        if (cleanupError) {
          // Aqui o órfão ficou mesmo. Logar o id é o que permite limpeza
          // manual no painel — sem ele, o domínio some do nosso alcance.
          console.error(
            "[EmailTeamSettingsUseCase][connectDomain] Falha ao remover domínio órfão no Resend",
            { domainId: data.id, domainName: data.name, cleanupError }
          )
        }

        return new Output(
          false,
          [],
          [mapResendDomainError(trackingError.message, "connect", domainName.trim())],
          null
        )
      }

      const connectedAt = new Date()
      const senderCount = await this.settingsRepo.countSenders(ctx.teamId)
      const deliveryFromEmail = buildDeliveryFromEmail(data.name)

      // Persistência DEPOIS do Resend e fora de transação: a guarda de
      // idempotência é o `resendDomainId` lido lá em cima. Uma transação
      // englobando as duas pontas deixaria um domínio órfão no provedor em caso
      // de rollback, e o retry bateria em 409.
      await this.settingsRepo.saveConnectedDomain(ctx.teamId, {
        domainId: data.id,
        domainName: data.name,
        status: "pending",
        region: DEFAULT_DOMAIN_REGION,
        connectedAt,
        openTracking: RESEND_TRACKING_POLICY.openTracking,
        clickTracking: RESEND_TRACKING_POLICY.clickTracking,
        // Só assume o endereço de entrega do domínio quando o time ainda não
        // escolheu nenhum remetente — caso contrário sobrescreveria a escolha dele.
        deliveryFrom:
          senderCount === 0
            ? { fromName: DEFAULTS.fromName, fromEmail: deliveryFromEmail }
            : null,
        createDefaults: { fromName: DEFAULTS.fromName, fromEmail: DEFAULTS.fromEmail },
      })

      await this.domainEvents.recordEventIfMissing(ctx.teamId, "domain_added", connectedAt, {
        domainId: data.id,
        domainName: data.name,
      })

      return new Output(true, ["Domínio conectado. Configure os registros DNS abaixo."], [], {
        domainId: data.id,
        domainName: data.name,
        status: "pending",
        region: DEFAULT_DOMAIN_REGION,
        connectedAt: connectedAt.toISOString(),
        // Mesma fonte que `saveConnectedDomain` logo acima — a resposta não tem
        // como divergir do que foi gravado. Antes eram dois literais soltos, e
        // o da resposta dizia `clickTracking: true`: mentira para o cliente da
        // API, que montaria relatório em cima de um clique que nunca chegaria.
        openTracking: RESEND_TRACKING_POLICY.openTracking,
        clickTracking: RESEND_TRACKING_POLICY.clickTracking,
        trackingSubdomain: DEFAULT_TRACKING_SUBDOMAIN,
        records: data.records ?? [],
      })
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][connectDomain]", error)
      return new Output(false, [], ["Erro ao conectar domínio"], null)
    }
  }

  async configureDomainTracking(
    input: ConfigureDomainTrackingInput,
    ctx: TeamContext
  ): Promise<Output> {
    try {
      if (!input.openTracking) {
        return new Output(
          false,
          [],
          ["Habilite a abertura para configurar o tracking."],
          null
        )
      }

      const trackingSubdomain = normalizeTrackingSubdomain(input.trackingSubdomain)
      if (!trackingSubdomain) {
        return new Output(
          false,
          [],
          [
            "Subdomínio de tracking inválido. Use apenas letras minúsculas, números e hífen (ex.: links).",
          ],
          null
        )
      }

      const settings = await this.settingsRepo.findSettings(ctx.teamId)
      if (!settings?.resendDomainId) {
        return new Output(false, [], ["Nenhum domínio conectado para configurar tracking"], null)
      }

      const resend = this.resendFactory()
      const { data: currentDomain, error: currentError } = await resend.domains.get(
        settings.resendDomainId
      )
      if (currentError || !currentDomain) {
        console.error(
          "[EmailTeamSettingsUseCase][configureDomainTracking] Resend get error",
          currentError
        )
        return new Output(
          false,
          [],
          [
            mapResendDomainError(
              currentError?.message,
              "tracking",
              settings.resendDomainName ?? undefined
            ),
          ],
          null
        )
      }

      const existingTrackingSubdomain =
        currentDomain.tracking_subdomain?.trim().toLowerCase() || null
      const trackingAlreadyConfigured = existingTrackingSubdomain === trackingSubdomain

      const updatePayload: {
        id: string
        openTracking: boolean
        clickTracking: boolean
        trackingSubdomain?: string
      } = {
        id: settings.resendDomainId,
        openTracking: input.openTracking,
        clickTracking: false,
      }
      if (!trackingAlreadyConfigured) {
        updatePayload.trackingSubdomain = trackingSubdomain
      }

      const { error } = await resend.domains.update(updatePayload)

      const maybeTrackingConflict =
        Boolean(error) &&
        (error?.statusCode === 409 || isTrackingSubdomainAlreadyExists(error?.message))

      if (error && !maybeTrackingConflict) {
        console.error("[EmailTeamSettingsUseCase][configureDomainTracking] Resend error", error)
        return new Output(
          false,
          [],
          [
            mapResendDomainError(
              error.message,
              "tracking",
              settings.resendDomainName ?? undefined
            ),
          ],
          null
        )
      }

      const { data: domainData, error: getError } = await resend.domains.get(
        settings.resendDomainId
      )
      if (getError || !domainData) {
        console.error(
          "[EmailTeamSettingsUseCase][configureDomainTracking] Resend get error",
          getError
        )
        return new Output(
          false,
          [],
          [mapResendDomainError(getError?.message, "tracking", settings.resendDomainName ?? undefined)],
          null
        )
      }

      const syncedTrackingSubdomain =
        domainData.tracking_subdomain?.trim().toLowerCase() || null
      // Idempotent only when THIS domain already owns the requested subdomain.
      // Unrelated 409s (e.g. subdomain on another domain) must surface as errors.
      const trackingConflict =
        maybeTrackingConflict &&
        (existingTrackingSubdomain === trackingSubdomain ||
          syncedTrackingSubdomain === trackingSubdomain)

      if (error && !trackingConflict) {
        console.error(
          "[EmailTeamSettingsUseCase][configureDomainTracking] Resend conflict not owned by domain",
          {
            domainId: settings.resendDomainId,
            trackingSubdomain,
            existingTrackingSubdomain,
            syncedTrackingSubdomain,
            error,
          }
        )
        return new Output(
          false,
          [],
          [
            mapResendDomainError(
              error.message,
              "tracking",
              settings.resendDomainName ?? undefined
            ),
          ],
          null
        )
      }

      if (trackingConflict) {
        console.info(
          "[EmailTeamSettingsUseCase][configureDomainTracking] Tracking subdomain already exists; syncing current domain state",
          { domainId: settings.resendDomainId, trackingSubdomain }
        )
      }

      const synced = await this.domainEvents.syncFromResendDomain(
        ctx.teamId,
        domainData,
        new Date()
      )

      const successMessage = trackingConflict
        ? "Subdomínio de tracking já existia no Resend. Status sincronizado — adicione o DNS de Tracking e re-verifique, se pendente."
        : "Métricas de tracking configuradas. Adicione o registro DNS de Tracking e re-verifique."

      return new Output(true, [successMessage], [], {
        domainId: domainData.id,
        domainName: domainData.name,
        status: synced.status as ResendDomainStatus,
        region: synced.region,
        openTracking: synced.openTracking,
        clickTracking: synced.clickTracking,
        trackingSubdomain: synced.trackingSubdomain ?? trackingSubdomain,
        records: domainData.records ?? [],
      })
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][configureDomainTracking]", error)
      return new Output(false, [], ["Erro ao configurar métricas de tracking"], null)
    }
  }

  async disconnectDomain(ctx: TeamContext): Promise<Output> {
    try {
      const settings = await this.settingsRepo.findSettings(ctx.teamId)
      if (!settings?.resendDomainId) {
        return new Output(false, [], ["Nenhum domínio conectado"], null)
      }

      const resend = this.resendFactory()
      const { error } = await resend.domains.remove(settings.resendDomainId)
      if (error) {
        console.error("[EmailTeamSettingsUseCase][disconnectDomain] Resend error", error)
        return new Output(
          false,
          [],
          [
            mapResendDomainError(
              error.message,
              "disconnect",
              settings.resendDomainName ?? undefined
            ),
          ],
          null
        )
      }

      const deletedAt = new Date()
      await this.domainEvents.recordEventIfMissing(ctx.teamId, "domain_deleted", deletedAt, {
        domainId: settings.resendDomainId,
        domainName: settings.resendDomainName,
      })

      const domainDelivery = settings.resendDomainName
        ? buildDeliveryFromEmail(settings.resendDomainName)
        : null
      const shouldResetFrom =
        !settings.fromEmail ||
        isPlatformDefaultFromEmail(settings.fromEmail) ||
        (domainDelivery !== null &&
          settings.fromEmail.trim().toLowerCase() === domainDelivery)

      // Método próprio do repositório, e não o `clearDomainSettings` do
      // EmailTeamDomainEventRepository: aquele limpa os campos resend* mas deixa
      // fromEmail/fromName apontando para um domínio que já saiu do Resend.
      await this.settingsRepo.clearConnectedDomain(
        ctx.teamId,
        shouldResetFrom
          ? { fromName: PLATFORM_FROM_NAME, fromEmail: PLATFORM_FROM_EMAIL }
          : null
      )

      return new Output(true, ["Domínio removido com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][disconnectDomain]", error)
      return new Output(false, [], ["Erro ao desconectar domínio"], null)
    }
  }

  async verifyDomain(ctx: TeamContext): Promise<Output> {
    try {
      const settings = await this.settingsRepo.findSettings(ctx.teamId)
      if (!settings?.resendDomainId) {
        return new Output(false, [], ["Nenhum domínio conectado para verificar"], null)
      }

      const resend = this.resendFactory()
      const { error } = await resend.domains.verify(settings.resendDomainId)
      if (error) {
        console.error("[EmailTeamSettingsUseCase][verifyDomain] Resend error", error)
        return new Output(false, [], [mapResendDomainError(error.message, "verify")], null)
      }

      const { data: domainData } = await resend.domains.get(settings.resendDomainId)
      if (!domainData) {
        return new Output(false, [], ["Domínio não encontrado no Resend"], null)
      }

      const synced = await this.domainEvents.syncFromResendDomain(
        ctx.teamId,
        domainData,
        new Date()
      )

      return new Output(true, ["Verificação iniciada"], [], {
        status: synced.status as ResendDomainStatus,
        region: synced.region,
        openTracking: synced.openTracking,
        clickTracking: synced.clickTracking,
        trackingSubdomain: synced.trackingSubdomain,
      })
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][verifyDomain]", error)
      return new Output(false, [], ["Erro ao verificar domínio"], null)
    }
  }

  async getDomainRecords(ctx: TeamContext): Promise<Output> {
    try {
      const settings = await this.settingsRepo.findSettings(ctx.teamId)
      if (!settings?.resendDomainId) {
        return new Output(false, [], ["Nenhum domínio conectado"], null)
      }

      const resend = this.resendFactory()
      const { data, error } = await resend.domains.get(settings.resendDomainId)
      if (error || !data) {
        console.error("[EmailTeamSettingsUseCase][getDomainRecords] Resend error", error)
        return new Output(
          false,
          [],
          [
            mapResendDomainError(
              error?.message,
              "records",
              settings.resendDomainName ?? undefined
            ),
          ],
          null
        )
      }

      const synced = await this.domainEvents.syncFromResendDomain(
        ctx.teamId,
        data,
        new Date()
      )

      const domainEvents = await this.domainEvents.listEvents(ctx.teamId)

      return new Output(true, [], [], {
        domainId: data.id,
        domainName: data.name,
        status: synced.status,
        region: synced.region ?? settings.resendDomainRegion,
        connectedAt: settings.resendDomainConnectedAt?.toISOString() ?? null,
        openTracking: synced.openTracking,
        clickTracking: synced.clickTracking,
        trackingSubdomain: synced.trackingSubdomain,
        records: data.records ?? [],
        events: domainEvents.map((event) => ({
          ...event,
          occurredAt: event.occurredAt.toISOString(),
        })),
      })
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][getDomainRecords]", error)
      return new Output(false, [], ["Erro ao buscar registros DNS"], null)
    }
  }
}
