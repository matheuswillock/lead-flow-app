import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { canManageWhatsAppInfrastructure } from "@/lib/whatsapp/conversation-access"
import { isWhatsAppTagColorToken } from "@/lib/whatsapp/tag-colors"
import { teamHasWhatsAppFeature } from "@/lib/whatsapp/team-has-whatsapp-feature"
import {
  isUniqueConstraintError,
  whatsAppConversationTagRepository,
} from "@/app/api/infra/data/repositories/whatsapp/WhatsAppConversationTagRepository"

interface TeamScopedInput {
  teamId: string
  access: TeamAccess
}

interface CreateTagInput extends TeamScopedInput {
  name: string
  color: string
  sortOrder?: number
}

interface UpdateTagInput extends TeamScopedInput {
  tagId: string
  name?: string
  color?: string
  sortOrder?: number
}

interface DeleteTagInput extends TeamScopedInput {
  tagId: string
}

class WhatsAppConversationTagUseCase {
  private assertManageAccess(access: TeamAccess): Output | null {
    if (canManageWhatsAppInfrastructure(access)) {
      return null
    }
    return new Output(false, [], ["Apenas gestores podem gerenciar tags"], null)
  }

  private async assertWhatsAppAddon(teamId: string): Promise<Output | null> {
    const hasFeature = await teamHasWhatsAppFeature(teamId)
    if (!hasFeature) {
      return new Output(false, [], ["Addon WhatsApp não está ativo para este time"], null)
    }
    return null
  }

  async list(input: TeamScopedInput): Promise<Output> {
    try {
      const addonError = await this.assertWhatsAppAddon(input.teamId)
      if (addonError) return addonError

      const tags = await whatsAppConversationTagRepository.listByTeamId(input.teamId)
      return new Output(true, [], [], { tags })
    } catch (error) {
      console.error("[WhatsAppConversationTagUseCase][list]", error)
      const message = error instanceof Error ? error.message : "Erro ao listar tags"
      return new Output(false, [], [message], null)
    }
  }

  async create(input: CreateTagInput): Promise<Output> {
    try {
      const accessError = this.assertManageAccess(input.access)
      if (accessError) return accessError

      const addonError = await this.assertWhatsAppAddon(input.teamId)
      if (addonError) return addonError

      const name = input.name.trim()
      if (!name) {
        return new Output(false, [], ["Nome da tag é obrigatório"], null)
      }

      if (!isWhatsAppTagColorToken(input.color)) {
        return new Output(false, [], ["Cor da tag inválida"], null)
      }

      const tag = await whatsAppConversationTagRepository.createTag({
        teamId: input.teamId,
        name,
        color: input.color,
        sortOrder: input.sortOrder,
      })

      return new Output(true, ["Tag criada com sucesso"], [], tag)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new Output(false, [], ["Já existe uma tag com este nome no time"], null)
      }
      console.error("[WhatsAppConversationTagUseCase][create]", error)
      const message = error instanceof Error ? error.message : "Erro ao criar tag"
      return new Output(false, [], [message], null)
    }
  }

  async update(input: UpdateTagInput): Promise<Output> {
    try {
      const accessError = this.assertManageAccess(input.access)
      if (accessError) return accessError

      const addonError = await this.assertWhatsAppAddon(input.teamId)
      if (addonError) return addonError

      const existing = await whatsAppConversationTagRepository.findByIdForTeam(input.tagId, input.teamId)
      if (!existing) {
        return new Output(false, [], ["Tag não encontrada"], null)
      }

      if (input.color !== undefined && !isWhatsAppTagColorToken(input.color)) {
        return new Output(false, [], ["Cor da tag inválida"], null)
      }

      const tag = await whatsAppConversationTagRepository.updateTag(input.tagId, {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      })

      return new Output(true, ["Tag atualizada com sucesso"], [], tag)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new Output(false, [], ["Já existe uma tag com este nome no time"], null)
      }
      console.error("[WhatsAppConversationTagUseCase][update]", error)
      const message = error instanceof Error ? error.message : "Erro ao atualizar tag"
      return new Output(false, [], [message], null)
    }
  }

  async delete(input: DeleteTagInput): Promise<Output> {
    try {
      const accessError = this.assertManageAccess(input.access)
      if (accessError) return accessError

      const addonError = await this.assertWhatsAppAddon(input.teamId)
      if (addonError) return addonError

      const existing = await whatsAppConversationTagRepository.findByIdForTeam(input.tagId, input.teamId)
      if (!existing) {
        return new Output(false, [], ["Tag não encontrada"], null)
      }

      await whatsAppConversationTagRepository.deleteTag(input.tagId)
      return new Output(true, ["Tag excluída com sucesso"], [], null)
    } catch (error) {
      console.error("[WhatsAppConversationTagUseCase][delete]", error)
      const message = error instanceof Error ? error.message : "Erro ao excluir tag"
      return new Output(false, [], [message], null)
    }
  }
}

export const whatsAppConversationTagUseCase = new WhatsAppConversationTagUseCase()
