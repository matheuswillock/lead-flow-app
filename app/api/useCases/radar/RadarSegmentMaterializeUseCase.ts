import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { featureAccessUseCase } from "@/app/api/useCases/featureAccess/FeatureAccessUseCase"
import { radarMaterializeRepository } from "@/app/api/infra/data/repositories/radar/RadarMaterializeRepository"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import { listRadarSegmentEmailRecipients } from "@/lib/radar/list-segment-recipients"
import {
  CUSTOM_RADAR_SEGMENT_PREFIX,
  parseCampaignRadarSegmentSlug,
} from "@/lib/radar/segment-audience"
import { isRadarSegmentSlug } from "@/lib/radar/segment-config"
import { teamRadarSegmentRepository } from "@/app/api/infra/data/repositories/radar/TeamRadarSegmentRepository"

const BATCH_SIZE = 500

type MaterializeInput = {
  teamId: string
  ctx: TeamAccess
  segmentSlug: string
  name?: string
}

const SYSTEM_SEGMENT_LABELS: Record<string, string> = {
  email_marketable: "Aptos para e-mail",
  email_blocked: "Bloqueados",
  opened_not_clicked: "Abriram e não clicaram",
  clicked_not_closed: "Clicaram e não fecharam",
  portfolio_renewal_due: "Carteira próxima de renovação",
  inactive_recent_campaign: "Sem campanha recente",
  portfolio_clients: "Carteira",
  crm_clients: "CRM",
}

export class RadarSegmentMaterializeUseCase {
  private async assertEmailFeature(ctx: TeamAccess): Promise<Output | null> {
    const featureOutput = await featureAccessUseCase.execute({
      profileId: ctx.profileId,
      managerId: ctx.managerId,
      activeTeamId: ctx.teamId,
      teamContext: {
        isMaster: ctx.isMaster,
        role: ctx.teamMember.role,
        functions: ctx.teamMember.functions,
        canManageAccountTeams: ctx.canManageAccountTeams,
        canCreateAccountUsers: ctx.canCreateAccountUsers,
      },
    })

    if (!featureOutput.isValid) {
      return new Output(false, [], ["Não foi possível validar o acesso ao e-mail"], null)
    }

    const slugs = (featureOutput.result as { slugs?: string[] } | null)?.slugs ?? []
    if (!slugs.includes(FEATURE_SLUGS.EMAIL_CONTACTS) && !slugs.includes(FEATURE_SLUGS.EMAIL)) {
      return new Output(false, [], ["Add-on de e-mail não está ativo para este time"], null)
    }

    return null
  }

  private async resolveSegmentName(teamId: string, segmentSlug: string): Promise<string | null> {
    if (segmentSlug.startsWith(CUSTOM_RADAR_SEGMENT_PREFIX)) {
      const segment = await teamRadarSegmentRepository.findById(
        teamId,
        segmentSlug.slice(CUSTOM_RADAR_SEGMENT_PREFIX.length)
      )
      return segment?.name ?? null
    }

    const campaignId = parseCampaignRadarSegmentSlug(segmentSlug)
    if (campaignId) {
      const name = await radarRepository.findEmailCampaignName(teamId, campaignId)
      return name ? `Campanha: ${name}` : null
    }

    if (isRadarSegmentSlug(segmentSlug)) {
      return SYSTEM_SEGMENT_LABELS[segmentSlug] ?? segmentSlug
    }

    return null
  }

  async execute(input: MaterializeInput): Promise<Output> {
    try {
      const emailError = await this.assertEmailFeature(input.ctx)
      if (emailError) return emailError

      const segmentName = await this.resolveSegmentName(input.teamId, input.segmentSlug)
      if (!segmentName) {
        return new Output(false, [], ["Segmento inválido"], null)
      }

      const recipients = await listRadarSegmentEmailRecipients(input.teamId, input.segmentSlug)
      if (recipients.length === 0) {
        return new Output(false, [], ["Nenhum contato com e-mail válido neste segmento"], null)
      }

      const listName = input.name?.trim() || `Segmento: ${segmentName}`
      const list = await radarMaterializeRepository.createContactList({
        teamId: input.teamId,
        createdBy: input.ctx.profileId,
        name: listName,
      })

      let imported = 0
      for (let offset = 0; offset < recipients.length; offset += BATCH_SIZE) {
        const batch = recipients.slice(offset, offset + BATCH_SIZE)
        imported += await radarMaterializeRepository.createContactsBatch(
          list.id,
          batch.map((recipient) => ({
            email: recipient.email,
            name: recipient.name,
            customFields: recipient.customFields,
          }))
        )
      }

      await radarMaterializeRepository.updateListTotalContacts(list.id, imported)

      return new Output(
        true,
        ["Lista de contatos criada com sucesso"],
        [],
        { listId: list.id, totalContacts: imported }
      )
    } catch (error) {
      console.error("[RadarSegmentMaterializeUseCase][execute]", error)
      return new Output(false, [], ["Erro ao materializar lista de contatos"], null)
    }
  }
}

export const radarSegmentMaterializeUseCase = new RadarSegmentMaterializeUseCase()
