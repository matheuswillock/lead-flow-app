import { Output } from "@/lib/output"
import { listRadarSegmentEmailRecipients } from "@/lib/radar/list-segment-recipients"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"
import {
  CUSTOM_RADAR_SEGMENT_PREFIX,
  isValidRadarSegmentAudience,
  parseCampaignRadarSegmentSlug,
} from "@/lib/radar/segment-audience"
import { isRadarSegmentSlug } from "@/lib/radar/segment-config"
import { teamRadarSegmentRepository } from "@/app/api/infra/data/repositories/radar/TeamRadarSegmentRepository"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { emailContactListRepository } from "@/app/api/infra/data/repositories/emailContactList/EmailContactListRepository"

export type MaterializeSegmentResult = {
  listId: string
  contactCount: number
}

export type PreviewSegmentResult = {
  estimatedCount: number
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

class MaterializeSegmentToContactListUseCase {
  private async resolveSegmentName(teamId: string, segmentSlug: string): Promise<string | null> {
    if (segmentSlug.startsWith(CUSTOM_RADAR_SEGMENT_PREFIX)) {
      const segmentId = segmentSlug.slice(CUSTOM_RADAR_SEGMENT_PREFIX.length)
      const segment = await teamRadarSegmentRepository.findById(teamId, segmentId)
      if (!segment?.isActive) return null
      return segment.name
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

  private async assertValidAudience(teamId: string, segmentSlug: string): Promise<Output | null> {
    const isValid = await isValidRadarSegmentAudience(teamId, segmentSlug)
    if (!isValid) {
      return new Output(false, [], ["Segmento inválido ou inativo"], null)
    }
    return null
  }

  async preview(teamId: string, segmentSlug: string): Promise<Output> {
    try {
      const validationError = await this.assertValidAudience(teamId, segmentSlug)
      if (validationError) return validationError

      const recipients = await listRadarSegmentEmailRecipients(teamId, segmentSlug)
      const result: PreviewSegmentResult = { estimatedCount: recipients.length }
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[MaterializeSegmentToContactListUseCase][preview]", error)
      return new Output(false, [], ["Erro ao calcular contagem estimada"], null)
    }
  }

  async execute(
    teamId: string,
    segmentSlug: string,
    ctx: Pick<TeamContext, "profileId">
  ): Promise<Output> {
    try {
      const validationError = await this.assertValidAudience(teamId, segmentSlug)
      if (validationError) return validationError

      const recipients = await listRadarSegmentEmailRecipients(teamId, segmentSlug)
      if (recipients.length === 0) {
        return new Output(false, [], ["Nenhum contato com e-mail válido neste segmento"], null)
      }

      const segmentName = await this.resolveSegmentName(teamId, segmentSlug)
      const displayName = segmentName ?? segmentSlug
      const timestamp = new Date().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      const listName = `Segmento: ${displayName} (${timestamp})`

      const list = await emailContactListRepository.createList({
        teamId,
        createdBy: ctx.profileId,
        name: listName,
      })

      const listId = list.id
      const BATCH_SIZE = 500
      let contactCount = 0

      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE)
        const emails = batch.map((r) => r.email)

        const existingEmails = await emailContactListRepository.findExistingEmailsInList(listId, emails)

        const newRows = batch.filter((r) => !existingEmails.has(r.email))
        if (newRows.length > 0) {
          const count = await emailContactListRepository.createContacts(listId, newRows)
          contactCount += count
        }
      }

      await emailContactListRepository.updateContactCount(listId, contactCount)

      const result: MaterializeSegmentResult = { listId, contactCount }
      return new Output(true, [`Lista criada com ${contactCount} contato(s)`], [], result)
    } catch (error) {
      console.error("[MaterializeSegmentToContactListUseCase][execute]", error)
      return new Output(false, [], ["Erro ao materializar segmento em lista de contatos"], null)
    }
  }
}

export const materializeSegmentToContactListUseCase = new MaterializeSegmentToContactListUseCase()
