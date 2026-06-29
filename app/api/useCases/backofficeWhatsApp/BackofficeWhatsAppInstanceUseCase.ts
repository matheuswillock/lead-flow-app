import type { WhatsAppConnectionStatus } from "@prisma/client"
import { Output } from "@/lib/output"
import { backofficeWhatsAppInstanceRepository } from "@/app/api/infra/data/repositories/backoffice/whatsapp/BackofficeWhatsAppInstanceRepository"
import type { BackofficeWhatsAppInstanceRow } from "@/app/api/infra/data/repositories/backoffice/whatsapp/IBackofficeWhatsAppInstanceRepository"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"
import { toQrCodeImageUrl } from "@/app/api/services/whatsapp/qrCodeUtils"
import { teamHasWhatsAppFeature } from "@/lib/whatsapp/team-has-whatsapp-feature"
import type { IBackofficeWhatsAppInstanceUseCase } from "./IBackofficeWhatsAppInstanceUseCase"

function resolveWebhookBaseUrl(): string {
  const webhookPublic = process.env.EVO_WEBHOOK_PUBLIC_URL?.replace(/\/$/, "")
  if (webhookPublic) return webhookPublic
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error("[BackofficeWhatsAppInstanceUseCase] NEXT_PUBLIC_APP_URL is not set")
  return appUrl.replace(/\/$/, "")
}

function buildWebhookUrl(webhookSecret: string): string {
  return `${resolveWebhookBaseUrl()}/api/webhooks/whatsapp/evolution/${webhookSecret}`
}

function toListItem(row: BackofficeWhatsAppInstanceRow) {
  return {
    id: row.id,
    teamId: row.teamId,
    provider: row.provider,
    instanceName: row.instanceName,
    instanceId: row.instanceId,
    phoneNumber: row.phoneNumber,
    displayName: row.displayName,
    status: row.status,
    hostBaseUrl: row.hostBaseUrl,
    lastConnectedAt: row.lastConnectedAt,
    lastDisconnectedAt: row.lastDisconnectedAt,
    lastSyncAt: row.lastSyncAt,
    historySyncStatus: row.historySyncStatus,
    usageLimitMonthly: row.usageLimitMonthly,
    billingEnabled: row.billingEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    team: row.team,
  }
}

function toDetailItem(row: BackofficeWhatsAppInstanceRow) {
  return {
    ...toListItem(row),
    qrCodeText: row.qrCodeText,
    qrCodeImageUrl: row.qrCodeImageUrl ? toQrCodeImageUrl(row.qrCodeImageUrl) : null,
    webhookUrl: buildWebhookUrl(row.webhookSecret),
    historySyncStartedAt: row.historySyncStartedAt,
    historySyncCompletedAt: row.historySyncCompletedAt,
    historySyncError: row.historySyncError,
  }
}

function buildPagination(page: number, pageSize: number, totalItems: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  }
}

export class BackofficeWhatsAppInstanceUseCase implements IBackofficeWhatsAppInstanceUseCase {
  async listInstances(
    filters: { q?: string; status?: WhatsAppConnectionStatus },
    pagination: { page: number; pageSize: number }
  ): Promise<Output> {
    try {
      const page = Math.max(pagination.page || 1, 1)
      const pageSize = Math.max(pagination.pageSize || 10, 5)

      const result = await backofficeWhatsAppInstanceRepository.listInstances(filters, {
        page,
        pageSize,
      })

      return new Output(true, [], [], {
        items: result.items.map(toListItem),
        pagination: buildPagination(page, pageSize, result.totalItems),
      })
    } catch (error) {
      console.error("[BackofficeWhatsAppInstanceUseCase][listInstances]", error)
      return new Output(false, [], ["Erro ao listar instâncias WhatsApp"], null)
    }
  }

  async getInstance(configId: string): Promise<Output> {
    try {
      const row = await backofficeWhatsAppInstanceRepository.findInstanceById(configId)
      if (!row) {
        return new Output(false, [], ["Instância não encontrada"], null)
      }

      const usage = await whatsAppService.getUsageSummary(row.teamId)

      return new Output(true, [], [], {
        ...toDetailItem(row),
        usage,
      })
    } catch (error) {
      console.error("[BackofficeWhatsAppInstanceUseCase][getInstance]", error)
      return new Output(false, [], ["Erro ao buscar instância WhatsApp"], null)
    }
  }

  async updateInstance(
    configId: string,
    data: {
      usageLimitMonthly?: number
      billingEnabled?: boolean
      hostBaseUrl?: string | null
      updatedByProfileId: string
    }
  ): Promise<Output> {
    try {
      const existing = await backofficeWhatsAppInstanceRepository.findInstanceById(configId)
      if (!existing) {
        return new Output(false, [], ["Instância não encontrada"], null)
      }

      if (
        data.usageLimitMonthly !== undefined &&
        (!Number.isFinite(data.usageLimitMonthly) || data.usageLimitMonthly < 0)
      ) {
        return new Output(false, [], ["Limite mensal inválido"], null)
      }

      const updated = await backofficeWhatsAppInstanceRepository.updateInstanceAdminFields(
        configId,
        data
      )

      const usage = await whatsAppService.getUsageSummary(updated.teamId)

      return new Output(
        true,
        ["Instância atualizada com sucesso"],
        [],
        { ...toDetailItem(updated), usage }
      )
    } catch (error) {
      console.error("[BackofficeWhatsAppInstanceUseCase][updateInstance]", error)
      return new Output(false, [], ["Erro ao atualizar instância WhatsApp"], null)
    }
  }

  async provisionInstance(data: {
    teamId: string
    profileId: string
    usageLimitMonthly?: number
    hostBaseUrl?: string
  }): Promise<Output> {
    try {
      const existing = await backofficeWhatsAppInstanceRepository.findInstanceByTeamId(data.teamId)
      if (existing) {
        return new Output(false, [], ["Este time já possui uma instância WhatsApp"], null)
      }

      const hasFeature = await teamHasWhatsAppFeature(data.teamId)
      if (!hasFeature) {
        return new Output(false, [], ["Time não possui acesso ao produto WhatsApp"], null)
      }

      const config = await whatsAppService.createConfig({
        teamId: data.teamId,
        profileId: data.profileId,
        usageLimitMonthly: data.usageLimitMonthly,
        hostBaseUrl: data.hostBaseUrl,
      })

      const row = await backofficeWhatsAppInstanceRepository.findInstanceByTeamId(data.teamId)
      if (!row) {
        return new Output(true, ["Instância provisionada com sucesso"], [], config)
      }

      const usage = await whatsAppService.getUsageSummary(row.teamId)

      return new Output(
        true,
        ["Instância provisionada com sucesso"],
        [],
        { ...toDetailItem(row), usage }
      )
    } catch (error) {
      console.error("[BackofficeWhatsAppInstanceUseCase][provisionInstance]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao provisionar instância WhatsApp"
      return new Output(false, [], [message], null)
    }
  }

  async reconnectInstance(configId: string, profileId: string): Promise<Output> {
    try {
      const row = await this.requireInstance(configId)
      if (row instanceof Output) return row

      await whatsAppService.reconnect(row.teamId, profileId)
      const refreshed = await backofficeWhatsAppInstanceRepository.findInstanceById(configId)
      if (!refreshed) {
        return new Output(false, [], ["Instância não encontrada após reconexão"], null)
      }

      const usage = await whatsAppService.getUsageSummary(refreshed.teamId)

      return new Output(
        true,
        ["Reconexão iniciada com sucesso"],
        [],
        { ...toDetailItem(refreshed), usage }
      )
    } catch (error) {
      console.error("[BackofficeWhatsAppInstanceUseCase][reconnectInstance]", error)
      const message = error instanceof Error ? error.message : "Erro ao reconectar instância"
      return new Output(false, [], [message], null)
    }
  }

  async disconnectInstance(configId: string, profileId: string): Promise<Output> {
    try {
      const row = await this.requireInstance(configId)
      if (row instanceof Output) return row

      await whatsAppService.disconnect(row.teamId, profileId)
      const refreshed = await backofficeWhatsAppInstanceRepository.findInstanceById(configId)
      if (!refreshed) {
        return new Output(false, [], ["Instância não encontrada após desconexão"], null)
      }

      const usage = await whatsAppService.getUsageSummary(refreshed.teamId)

      return new Output(
        true,
        ["Instância desconectada com sucesso"],
        [],
        { ...toDetailItem(refreshed), usage }
      )
    } catch (error) {
      console.error("[BackofficeWhatsAppInstanceUseCase][disconnectInstance]", error)
      const message = error instanceof Error ? error.message : "Erro ao desconectar instância"
      return new Output(false, [], [message], null)
    }
  }

  async syncHistory(configId: string): Promise<Output> {
    try {
      const row = await this.requireInstance(configId)
      if (row instanceof Output) return row

      const syncResult = await whatsAppService.syncTeamHistory(row.teamId)
      const refreshed = await backofficeWhatsAppInstanceRepository.findInstanceById(configId)
      if (!refreshed) {
        return new Output(false, [], ["Instância não encontrada após sincronização"], null)
      }

      const usage = await whatsAppService.getUsageSummary(refreshed.teamId)

      return new Output(
        true,
        [`Histórico sincronizado: ${syncResult.chats} conversas, ${syncResult.messages} mensagens`],
        [],
        { ...toDetailItem(refreshed), usage, syncResult }
      )
    } catch (error) {
      console.error("[BackofficeWhatsAppInstanceUseCase][syncHistory]", error)
      const message = error instanceof Error ? error.message : "Erro ao sincronizar histórico"
      return new Output(false, [], [message], null)
    }
  }

  async listTeamsWithoutInstance(
    filters: { q?: string },
    pagination: { page: number; pageSize: number }
  ): Promise<Output> {
    try {
      const page = Math.max(pagination.page || 1, 1)
      const pageSize = Math.max(pagination.pageSize || 20, 5)

      const result = await backofficeWhatsAppInstanceRepository.listTeamsWithoutConfig(
        filters,
        { page, pageSize: pageSize * 3 }
      )

      const eligible: typeof result.items = []
      for (const team of result.items) {
        if (eligible.length >= pageSize) break
        const hasFeature = await teamHasWhatsAppFeature(team.id)
        if (hasFeature) eligible.push(team)
      }

      return new Output(true, [], [], {
        items: eligible,
        pagination: buildPagination(page, pageSize, result.totalItems),
      })
    } catch (error) {
      console.error("[BackofficeWhatsAppInstanceUseCase][listTeamsWithoutInstance]", error)
      return new Output(false, [], ["Erro ao listar times elegíveis"], null)
    }
  }

  private async requireInstance(
    configId: string
  ): Promise<BackofficeWhatsAppInstanceRow | Output> {
    const row = await backofficeWhatsAppInstanceRepository.findInstanceById(configId)
    if (!row) {
      return new Output(false, [], ["Instância não encontrada"], null)
    }
    return row
  }
}

export const backofficeWhatsAppInstanceUseCase = new BackofficeWhatsAppInstanceUseCase()
