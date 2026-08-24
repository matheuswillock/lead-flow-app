import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
// Função pura de domínio: o invariante "quem é o From do time" cruza
// emailTeamSender e emailTeamSettings e precisa ser resolvido DENTRO da
// transação, com o estado pós-escrita. Precedente: EmailLogRepository importa
// withDeadlockRetry e shouldStampIsBouncedFromEventMetadata do mesmo jeito.
import { resolveCampaignFrom } from "@/lib/email/resolve-campaign-from"
import type {
  BlockedDateRange,
  ConnectedDomainInput,
  DispatchPolicyPatch,
  EmailSenderPayload,
  EmailTeamSenderRecord,
  EmailTeamSettingsRecord,
  EmailTeamSettingsSnapshot,
  EmailTeamVariableRecord,
  IEmailTeamSettingsRepository,
} from "./IEmailTeamSettingsRepository"

/**
 * Fronteira de posse deste repositório (decidida antes do código, para não virar
 * discussão no meio do refactor):
 *
 * - É dono de `emailTeamSender` inteiro e das colunas de disparo/From/domínio de
 *   `emailTeamSettings`.
 * - Tem posse TEMPORÁRIA de uma leitura mínima de `emailTeamVariable`, só para
 *   compor o snapshot da tela. Ela migra quando nascer o EmailTeamVariableRepository.
 * - NÃO absorve `EmailTeamDomainEventRepository` (findTeamByResendDomainId,
 *   updateDomainTracking, clearDomainSettings, listConnectedDomains,
 *   syncFromResendDomain). Mover aqueles métodos rippla para o UseCase de
 *   reconciliação, o de webhook e os testes de ambos — escopo diferente.
 * - NÃO faz chamada HTTP. Toda interação com o Resend fica no UseCase; aqui só
 *   persistimos o resultado dela.
 */

const settingsSelect = {
  fromName: true,
  fromEmail: true,
  replyTo: true,
  dispatchBlockedDates: true,
  dispatchTimeFrom: true,
  dispatchTimeTo: true,
  dispatchAllowedRoles: true,
  templateCreateRoles: true,
  templateApprovalRequired: true,
  templateApprovalRoles: true,
  blockedDispatchDays: true,
  resendDomainId: true,
  resendDomainName: true,
  resendDomainStatus: true,
  resendDomainRegion: true,
  resendDomainConnectedAt: true,
  resendOpenTracking: true,
  resendClickTracking: true,
} satisfies Prisma.EmailTeamSettingsSelect

const senderSelect = {
  id: true,
  name: true,
  email: true,
  replyTo: true,
  isDefault: true,
} satisfies Prisma.EmailTeamSenderSelect

const variableSelect = {
  id: true,
  key: true,
  type: true,
  defaultValue: true,
  description: true,
  isActive: true,
} satisfies Prisma.EmailTeamVariableSelect

/**
 * `orderBy` compartilhado por TODAS as leituras de remetente. É ele que define
 * quem é promovido a padrão no fallback de `ensureSingleDefaultSender`; duas
 * ordenações divergentes fariam a promoção depender de qual caminho leu a lista.
 */
const senderOrderBy: Prisma.EmailTeamSenderOrderByWithRelationInput[] = [
  { isDefault: "desc" },
  { createdAt: "asc" },
  { name: "asc" },
]

/**
 * Defaults gravados no banco quando a linha de configuração ainda não existe.
 * Repetem os `@default` do schema de propósito: o `create` do upsert precisa de
 * um objeto completo, e depender do default implícito do Postgres tornaria o
 * comportamento invisível na leitura do código.
 */
const CREATE_DEFAULTS = {
  replyTo: null,
  dispatchTimeFrom: null,
  dispatchTimeTo: null,
  dispatchAllowedRoles: ["manager", "backoffice"],
  templateCreateRoles: ["manager", "backoffice"],
  templateApprovalRequired: false,
  templateApprovalRoles: ["manager", "backoffice"],
  blockedDispatchDays: [] as number[],
}

const CLEAR_DOMAIN_DATA = {
  resendDomainId: null,
  resendDomainName: null,
  resendDomainStatus: null,
  resendDomainRegion: null,
  resendDomainConnectedAt: null,
  resendOpenTracking: false,
  resendClickTracking: false,
} as const

/**
 * Sentinela de rollback. Precisa ser um `throw` DENTRO do callback da transação:
 * é o throw que faz o Prisma reverter as escritas já emitidas. Trocar por um
 * `return null` cedo abortaria a lógica mas comitaria o que já foi escrito.
 */
const SENDER_NOT_FOUND = "SENDER_NOT_FOUND"

function isSenderNotFound(error: unknown): boolean {
  return error instanceof Error && error.message === SENDER_NOT_FOUND
}

type SettingsRow = Prisma.EmailTeamSettingsGetPayload<{ select: typeof settingsSelect }>

function toSettingsRecord(row: SettingsRow | null): EmailTeamSettingsRecord | null {
  if (!row) return null
  return {
    ...row,
    // `Json?` volta como Prisma.JsonValue; o formato é garantido na escrita
    // (validateBlockedDates no UseCase), então o cast é o boundary de confiança.
    dispatchBlockedDates: (row.dispatchBlockedDates ?? null) as BlockedDateRange[] | null,
  }
}

export class EmailTeamSettingsRepository implements IEmailTeamSettingsRepository {
  // ---------------------------------------------------------------------------
  // Leituras — reaproveitadas dentro e fora de transação
  // ---------------------------------------------------------------------------

  private async readSettings(
    client: Prisma.TransactionClient,
    teamId: string
  ): Promise<EmailTeamSettingsRecord | null> {
    const row = await client.emailTeamSettings.findUnique({
      where: { teamId },
      select: settingsSelect,
    })
    return toSettingsRecord(row)
  }

  private async readSenders(
    client: Prisma.TransactionClient,
    teamId: string
  ): Promise<EmailTeamSenderRecord[]> {
    return client.emailTeamSender.findMany({
      where: { teamId },
      select: senderSelect,
      orderBy: senderOrderBy,
    })
  }

  private async readVariables(
    client: Prisma.TransactionClient,
    teamId: string
  ): Promise<EmailTeamVariableRecord[]> {
    return client.emailTeamVariable.findMany({
      where: { teamId },
      select: variableSelect,
      orderBy: [{ key: "asc" }],
    })
  }

  private async readSnapshot(
    client: Prisma.TransactionClient,
    teamId: string
  ): Promise<EmailTeamSettingsSnapshot> {
    const settings = await this.readSettings(client, teamId)
    const senders = await this.readSenders(client, teamId)
    const variables = await this.readVariables(client, teamId)
    return { settings, senders, variables }
  }

  // ---------------------------------------------------------------------------
  // Invariantes internos de remetente
  // ---------------------------------------------------------------------------

  /**
   * Espelha o remetente padrão nas colunas legadas fromName/fromEmail/replyTo,
   * que são o que o disparo de campanha lê.
   *
   * O re-read de `resendDomainName` acontece DENTRO da transação de propósito:
   * `resolveCampaignFrom` depende do estado pós-escrita e, sem o domínio, um time
   * verificado e sem remetentes degrada de `contato@<dominio>` para o From da
   * plataforma — que passa em `assertCampaignFromIsSendable`. A campanha sairia
   * com sucesso, do remetente errado, e só o destinatário perceberia.
   */
  private async syncLegacySenderFields(
    tx: Prisma.TransactionClient,
    teamId: string,
    sender: EmailSenderPayload | null,
    domainName?: string | null
  ): Promise<void> {
    const resolvedDomain =
      domainName ??
      (
        await tx.emailTeamSettings.findUnique({
          where: { teamId },
          select: { resendDomainName: true },
        })
      )?.resendDomainName

    const resolvedFrom = resolveCampaignFrom({
      domainName: resolvedDomain,
      defaultSender: sender,
    })

    // Upsert próprio, jamais um upsert genérico compartilhado com
    // saveDispatchPolicy/saveConnectedDomain: este `create` NÃO toca em
    // resendDomain*, e genericizar faria um salvamento de remetente apagar o
    // domínio conectado.
    await tx.emailTeamSettings.upsert({
      where: { teamId },
      create: {
        teamId,
        fromName: resolvedFrom.fromName,
        fromEmail: resolvedFrom.fromEmail,
        replyTo: sender?.replyTo ?? CREATE_DEFAULTS.replyTo,
        dispatchAllowedRoles: CREATE_DEFAULTS.dispatchAllowedRoles,
        templateCreateRoles: CREATE_DEFAULTS.templateCreateRoles,
        templateApprovalRequired: CREATE_DEFAULTS.templateApprovalRequired,
        templateApprovalRoles: CREATE_DEFAULTS.templateApprovalRoles,
        blockedDispatchDays: CREATE_DEFAULTS.blockedDispatchDays,
      },
      update: {
        fromName: resolvedFrom.fromName,
        fromEmail: resolvedFrom.fromEmail,
        replyTo: sender?.replyTo ?? CREATE_DEFAULTS.replyTo,
      },
    })
  }

  /**
   * Garante "exatamente um remetente padrão". Não existe unique em
   * (teamId, isDefault) no schema, então esta sequência dentro de uma única
   * transação é a ÚNICA garantia: zero defaults derruba o From para os campos
   * legados e dois defaults fazem o From oscilar entre requests — ambos mudos.
   */
  private async ensureSingleDefaultSender(
    tx: Prisma.TransactionClient,
    teamId: string
  ): Promise<void> {
    const senders = await this.readSenders(tx, teamId)
    if (senders.length === 0) {
      await this.syncLegacySenderFields(tx, teamId, null)
      return
    }

    const defaultSender = senders.find((sender) => sender.isDefault) ?? senders[0]

    // `id: { not: ... }` mantém o eleito intacto: rebaixar todo mundo antes de
    // promover deixaria o time sem default no meio da transação.
    await tx.emailTeamSender.updateMany({
      where: { teamId, id: { not: defaultSender.id }, isDefault: true },
      data: { isDefault: false },
    })

    if (!defaultSender.isDefault) {
      await tx.emailTeamSender.update({
        where: { id: defaultSender.id },
        data: { isDefault: true },
      })
    }

    await this.syncLegacySenderFields(tx, teamId, {
      name: defaultSender.name,
      email: defaultSender.email,
      replyTo: defaultSender.replyTo,
    })
  }

  // ---------------------------------------------------------------------------
  // Leituras públicas
  // ---------------------------------------------------------------------------

  async findSettings(teamId: string): Promise<EmailTeamSettingsRecord | null> {
    return this.readSettings(prisma, teamId)
  }

  async listSenders(teamId: string): Promise<EmailTeamSenderRecord[]> {
    return this.readSenders(prisma, teamId)
  }

  async countSenders(teamId: string): Promise<number> {
    return prisma.emailTeamSender.count({ where: { teamId } })
  }

  // ---------------------------------------------------------------------------
  // Unidades de trabalho transacionais
  // ---------------------------------------------------------------------------

  async findSettingsSnapshot(teamId: string): Promise<EmailTeamSettingsSnapshot> {
    // Leitura agrupada: as três consultas precisam enxergar o mesmo estado, senão
    // um remetente criado entre elas produz um From inconsistente com a lista.
    return prisma.$transaction(async (tx) => this.readSnapshot(tx, teamId))
  }

  async saveDispatchPolicy(
    teamId: string,
    patch: DispatchPolicyPatch
  ): Promise<EmailTeamSettingsSnapshot> {
    return prisma.$transaction(async (tx) => {
      // O `existing` alimenta o branch `create` e precisa vir da MESMA transação
      // do upsert; o re-read seguinte precisa enxergar a própria escrita.
      const existing = await this.readSettings(tx, teamId)

      await tx.emailTeamSettings.upsert({
        where: { teamId },
        create: {
          teamId,
          fromName: existing?.fromName ?? patch.createDefaults.fromName,
          fromEmail: existing?.fromEmail ?? patch.createDefaults.fromEmail,
          replyTo: existing?.replyTo ?? CREATE_DEFAULTS.replyTo,
          // Coluna Json: ausência de valor é Prisma.JsonNull aqui e Prisma.DbNull
          // no update. Trocar um pelo outro grava valor diferente ou lança em runtime.
          dispatchBlockedDates:
            patch.dispatchBlockedDates === undefined || patch.dispatchBlockedDates === null
              ? Prisma.JsonNull
              : patch.dispatchBlockedDates,
          dispatchTimeFrom: patch.dispatchTimeFrom ?? CREATE_DEFAULTS.dispatchTimeFrom,
          dispatchTimeTo: patch.dispatchTimeTo ?? CREATE_DEFAULTS.dispatchTimeTo,
          dispatchAllowedRoles:
            patch.dispatchAllowedRoles ?? CREATE_DEFAULTS.dispatchAllowedRoles,
          templateCreateRoles:
            patch.templateCreateRoles ?? CREATE_DEFAULTS.templateCreateRoles,
          templateApprovalRequired:
            patch.templateApprovalRequired ?? CREATE_DEFAULTS.templateApprovalRequired,
          templateApprovalRoles:
            patch.templateApprovalRoles ?? CREATE_DEFAULTS.templateApprovalRoles,
          blockedDispatchDays:
            patch.blockedDispatchDays ?? CREATE_DEFAULTS.blockedDispatchDays,
          // Preserva o domínio já conectado: sem estas três linhas, salvar a
          // janela de disparo em uma corrida que caia no `create` apagaria o domínio.
          resendDomainId: existing?.resendDomainId ?? null,
          resendDomainName: existing?.resendDomainName ?? null,
          resendDomainStatus: existing?.resendDomainStatus ?? null,
        },
        update: {
          // `undefined` = campo não veio no patch (não mexer);
          // `null` = veio explicitamente para limpar.
          ...(patch.dispatchBlockedDates !== undefined && {
            dispatchBlockedDates:
              patch.dispatchBlockedDates === null
                ? Prisma.DbNull
                : patch.dispatchBlockedDates,
          }),
          ...(patch.dispatchTimeFrom !== undefined && {
            dispatchTimeFrom: patch.dispatchTimeFrom,
          }),
          ...(patch.dispatchTimeTo !== undefined && { dispatchTimeTo: patch.dispatchTimeTo }),
          ...(patch.dispatchAllowedRoles !== undefined && {
            dispatchAllowedRoles: patch.dispatchAllowedRoles,
          }),
          ...(patch.templateCreateRoles !== undefined && {
            templateCreateRoles: patch.templateCreateRoles,
          }),
          ...(patch.templateApprovalRequired !== undefined && {
            templateApprovalRequired: patch.templateApprovalRequired,
          }),
          ...(patch.templateApprovalRoles !== undefined && {
            templateApprovalRoles: patch.templateApprovalRoles,
          }),
          ...(patch.blockedDispatchDays !== undefined && {
            blockedDispatchDays: patch.blockedDispatchDays ?? [],
          }),
        },
      })

      return this.readSnapshot(tx, teamId)
    })
  }

  async createSender(
    teamId: string,
    payload: EmailSenderPayload
  ): Promise<EmailTeamSenderRecord> {
    return prisma.$transaction(async (tx) => {
      const senderCount = await tx.emailTeamSender.count({ where: { teamId } })
      const created = await tx.emailTeamSender.create({
        data: {
          teamId,
          ...payload,
          isDefault: senderCount === 0,
        },
        select: senderSelect,
      })

      await this.ensureSingleDefaultSender(tx, teamId)

      return created
    })
  }

  async updateSender(
    teamId: string,
    senderId: string,
    payload: EmailSenderPayload
  ): Promise<EmailTeamSenderRecord | null> {
    try {
      return await prisma.$transaction(async (tx) => {
        // findFirst filtrando por teamId: `update` por id sozinho permitiria
        // editar o remetente de outro time.
        const existing = await tx.emailTeamSender.findFirst({
          where: { id: senderId, teamId },
          select: { id: true },
        })
        if (!existing) {
          throw new Error(SENDER_NOT_FOUND)
        }

        const updated = await tx.emailTeamSender.update({
          where: { id: senderId },
          data: payload,
          select: senderSelect,
        })

        await this.ensureSingleDefaultSender(tx, teamId)
        return updated
      })
    } catch (error) {
      // Traduzido para `null` só aqui, FORA da transação — dentro dela o throw
      // ainda é o que dispara o rollback.
      if (isSenderNotFound(error)) return null
      throw error
    }
  }

  async deleteSender(teamId: string, senderId: string): Promise<boolean> {
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.emailTeamSender.findFirst({
          where: { id: senderId, teamId },
          select: { id: true },
        })
        if (!existing) {
          throw new Error(SENDER_NOT_FOUND)
        }

        await tx.emailTeamSender.delete({ where: { id: senderId } })
        await this.ensureSingleDefaultSender(tx, teamId)
      })
      return true
    } catch (error) {
      if (isSenderNotFound(error)) return false
      throw error
    }
  }

  async promoteSenderToDefault(
    teamId: string,
    senderId: string
  ): Promise<EmailTeamSettingsSnapshot | null> {
    try {
      return await prisma.$transaction(async (tx) => {
        const sender = await tx.emailTeamSender.findFirst({
          where: { id: senderId, teamId },
          select: senderSelect,
        })
        if (!sender) {
          throw new Error(SENDER_NOT_FOUND)
        }

        // Mesma forma de rebaixamento usada por ensureSingleDefaultSender: o
        // eleito fica de fora do updateMany, então o time nunca fica sem default.
        await tx.emailTeamSender.updateMany({
          where: { teamId, id: { not: senderId }, isDefault: true },
          data: { isDefault: false },
        })

        if (!sender.isDefault) {
          await tx.emailTeamSender.update({
            where: { id: senderId },
            data: { isDefault: true },
          })
        }

        await this.syncLegacySenderFields(tx, teamId, {
          name: sender.name,
          email: sender.email,
          replyTo: sender.replyTo,
        })

        return this.readSnapshot(tx, teamId)
      })
    } catch (error) {
      if (isSenderNotFound(error)) return null
      throw error
    }
  }

  // ---------------------------------------------------------------------------
  // Escritas de domínio Resend — sem transação, por decisão de projeto
  // ---------------------------------------------------------------------------

  /**
   * Sem `$transaction`: o UseCase cria o domínio no Resend ANTES de chamar aqui, e
   * usa `resendDomainId` como guarda de idempotência. Envolver em transação faria
   * um rollback deixar um domínio órfão no provedor, e o retry bateria em 409.
   */
  async saveConnectedDomain(teamId: string, input: ConnectedDomainInput): Promise<void> {
    await prisma.emailTeamSettings.upsert({
      where: { teamId },
      create: {
        teamId,
        fromName: input.deliveryFrom?.fromName ?? input.createDefaults.fromName,
        fromEmail: input.deliveryFrom?.fromEmail ?? input.createDefaults.fromEmail,
        resendDomainId: input.domainId,
        resendDomainName: input.domainName,
        resendDomainStatus: input.status,
        resendDomainRegion: input.region,
        resendDomainConnectedAt: input.connectedAt,
        resendOpenTracking: input.openTracking,
        resendClickTracking: input.clickTracking,
        dispatchAllowedRoles: CREATE_DEFAULTS.dispatchAllowedRoles,
        templateCreateRoles: CREATE_DEFAULTS.templateCreateRoles,
        templateApprovalRequired: CREATE_DEFAULTS.templateApprovalRequired,
        templateApprovalRoles: CREATE_DEFAULTS.templateApprovalRoles,
        blockedDispatchDays: CREATE_DEFAULTS.blockedDispatchDays,
      },
      update: {
        resendDomainId: input.domainId,
        resendDomainName: input.domainName,
        resendDomainStatus: input.status,
        resendDomainRegion: input.region,
        resendDomainConnectedAt: input.connectedAt,
        resendOpenTracking: input.openTracking,
        resendClickTracking: input.clickTracking,
        ...(input.deliveryFrom
          ? {
              fromEmail: input.deliveryFrom.fromEmail,
              fromName: input.deliveryFrom.fromName,
            }
          : {}),
      },
    })
  }

  async clearConnectedDomain(
    teamId: string,
    resetFrom: { fromName: string; fromEmail: string } | null
  ): Promise<void> {
    await prisma.emailTeamSettings.update({
      where: { teamId },
      data: {
        ...CLEAR_DOMAIN_DATA,
        ...(resetFrom ? { fromEmail: resetFrom.fromEmail, fromName: resetFrom.fromName } : {}),
      },
    })
  }
}

export const emailTeamSettingsRepository = new EmailTeamSettingsRepository()
