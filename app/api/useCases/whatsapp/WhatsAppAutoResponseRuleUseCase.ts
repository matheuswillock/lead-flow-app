import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import {
  whatsAppAutoResponseRepository,
  type WhatsAppAutoResponseRuleSelect,
} from "@/app/api/infra/data/repositories/whatsapp/WhatsAppAutoResponseRepository"
import { teamHasWhatsAppFeature } from "@/lib/whatsapp/team-has-whatsapp-feature"
import { Prisma, type WhatsAppAutoResponseMatchMode, type WhatsAppAutoResponseRuleType } from "@prisma/client"
import { isManagerLikeRole } from "@/lib/roles"

interface TeamScopedInput {
  teamId: string
  callerIsMaster: boolean
  callerRole: string
}

interface CreateRuleInput extends TeamScopedInput {
  type: WhatsAppAutoResponseRuleType
  replyMessage: string
  triggerKeywords?: string[]
  matchMode?: WhatsAppAutoResponseMatchMode
  offHoursSchedule?: unknown
  isActive?: boolean
  priority?: number
}

interface UpdateRuleInput extends TeamScopedInput {
  ruleId: string
  replyMessage?: string
  triggerKeywords?: string[]
  matchMode?: WhatsAppAutoResponseMatchMode
  offHoursSchedule?: unknown | null
  isActive?: boolean
  priority?: number
}

class WhatsAppAutoResponseRuleUseCase {
  private assertManagerAccess(input: TeamScopedInput): Output | null {
    if (input.callerIsMaster || isManagerLikeRole(input.callerRole)) {
      return null
    }
    return new Output(false, [], ["Apenas gestores podem gerenciar auto-respostas"], null)
  }

  private async assertWhatsAppAddon(teamId: string): Promise<Output | null> {
    const hasFeature = await teamHasWhatsAppFeature(teamId)
    if (!hasFeature) {
      return new Output(false, [], ["Addon WhatsApp não está ativo para este time"], null)
    }
    return null
  }

  private async resolveConfig(teamId: string) {
    const config = await whatsAppRepository.findConfigByTeamId(teamId)
    if (!config) return null
    return config
  }

  async list(input: TeamScopedInput): Promise<Output> {
    try {
      const accessError = this.assertManagerAccess(input)
      if (accessError) return accessError

      const addonError = await this.assertWhatsAppAddon(input.teamId)
      if (addonError) return addonError

      const config = await this.resolveConfig(input.teamId)
      if (!config) {
        return new Output(false, [], ["Configuração WhatsApp não encontrada"], null)
      }

      await whatsAppAutoResponseRepository.seedDefaultRules(config.id)
      const rules = await whatsAppAutoResponseRepository.listRulesByConfigId(config.id)
      return new Output(true, [], [], { rules })
    } catch (error) {
      console.error("[WhatsAppAutoResponseRuleUseCase][list]", error)
      const message = error instanceof Error ? error.message : "Erro ao listar regras"
      return new Output(false, [], [message], null)
    }
  }

  async create(input: CreateRuleInput): Promise<Output> {
    try {
      const accessError = this.assertManagerAccess(input)
      if (accessError) return accessError

      const addonError = await this.assertWhatsAppAddon(input.teamId)
      if (addonError) return addonError

      const config = await this.resolveConfig(input.teamId)
      if (!config) {
        return new Output(false, [], ["Configuração WhatsApp não encontrada"], null)
      }

      const rule = await whatsAppAutoResponseRepository.createRule({
        config: { connect: { id: config.id } },
        type: input.type,
        replyMessage: input.replyMessage,
        triggerKeywords: input.triggerKeywords ?? [],
        matchMode: input.matchMode ?? "CONTAINS",
        ...(input.offHoursSchedule !== undefined
          ? { offHoursSchedule: input.offHoursSchedule as Prisma.InputJsonValue }
          : {}),
        isActive: input.isActive ?? false,
        priority: input.priority ?? 0,
      })

      return new Output(true, ["Regra criada com sucesso"], [], rule)
    } catch (error) {
      console.error("[WhatsAppAutoResponseRuleUseCase][create]", error)
      const message = error instanceof Error ? error.message : "Erro ao criar regra"
      return new Output(false, [], [message], null)
    }
  }

  async update(input: UpdateRuleInput): Promise<Output> {
    try {
      const accessError = this.assertManagerAccess(input)
      if (accessError) return accessError

      const addonError = await this.assertWhatsAppAddon(input.teamId)
      if (addonError) return addonError

      const config = await this.resolveConfig(input.teamId)
      if (!config) {
        return new Output(false, [], ["Configuração WhatsApp não encontrada"], null)
      }

      const existing = await whatsAppAutoResponseRepository.findRuleByIdForConfig(
        input.ruleId,
        config.id
      )
      if (!existing) {
        return new Output(false, [], ["Regra não encontrada"], null)
      }

      const rule = await whatsAppAutoResponseRepository.updateRule(input.ruleId, {
        ...(input.replyMessage !== undefined ? { replyMessage: input.replyMessage } : {}),
        ...(input.triggerKeywords !== undefined ? { triggerKeywords: input.triggerKeywords } : {}),
        ...(input.matchMode !== undefined ? { matchMode: input.matchMode } : {}),
        ...(input.offHoursSchedule !== undefined
          ? {
              offHoursSchedule:
                input.offHoursSchedule === null
                  ? Prisma.JsonNull
                  : (input.offHoursSchedule as Prisma.InputJsonValue),
            }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
      })

      return new Output(true, ["Regra atualizada com sucesso"], [], rule)
    } catch (error) {
      console.error("[WhatsAppAutoResponseRuleUseCase][update]", error)
      const message = error instanceof Error ? error.message : "Erro ao atualizar regra"
      return new Output(false, [], [message], null)
    }
  }

  async delete(input: TeamScopedInput & { ruleId: string }): Promise<Output> {
    try {
      const accessError = this.assertManagerAccess(input)
      if (accessError) return accessError

      const addonError = await this.assertWhatsAppAddon(input.teamId)
      if (addonError) return addonError

      const config = await this.resolveConfig(input.teamId)
      if (!config) {
        return new Output(false, [], ["Configuração WhatsApp não encontrada"], null)
      }

      const existing = await whatsAppAutoResponseRepository.findRuleByIdForConfig(
        input.ruleId,
        config.id
      )
      if (!existing) {
        return new Output(false, [], ["Regra não encontrada"], null)
      }

      await whatsAppAutoResponseRepository.deleteRule(input.ruleId)
      return new Output(true, ["Regra removida com sucesso"], [], null)
    } catch (error) {
      console.error("[WhatsAppAutoResponseRuleUseCase][delete]", error)
      const message = error instanceof Error ? error.message : "Erro ao remover regra"
      return new Output(false, [], [message], null)
    }
  }

  async toggle(input: TeamScopedInput & { ruleId: string; isActive: boolean }): Promise<Output> {
    return this.update({
      ...input,
      isActive: input.isActive,
    })
  }
}

export const whatsAppAutoResponseRuleUseCase = new WhatsAppAutoResponseRuleUseCase()

export type { WhatsAppAutoResponseRuleSelect }
