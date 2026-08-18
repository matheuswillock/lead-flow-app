import { Output } from "@/lib/output"
import {
  emailCampaignAudiencePruningService,
  type CampaignAudiencePruneResult,
} from "@/app/api/services/emailCampaignAudience/EmailCampaignAudiencePruningService"
import { emailCampaignAudienceRepository } from "@/app/api/infra/data/repositories/emailCampaignAudience/EmailCampaignAudienceRepository"

type PruneInput = {
  teamId: string
  contactIds?: string[]
  emails?: string[]
  listIds?: string[]
}

export class EmailCampaignAudiencePruneUseCase {
  async pruneSuppressedContacts(input: PruneInput): Promise<Output> {
    try {
      const result = await emailCampaignAudiencePruningService.pruneSuppressedContacts(input)
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[EmailCampaignAudiencePruneUseCase][pruneSuppressedContacts]", error)
      return new Output(false, [], ["Erro ao podar audiência de campanhas"], null)
    }
  }

  async reconcileTeamCampaigns(teamId: string): Promise<Output> {
    try {
      const result = await emailCampaignAudiencePruningService.reconcileTeamCampaigns(teamId)
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[EmailCampaignAudiencePruneUseCase][reconcileTeamCampaigns]", error)
      return new Output(false, [], ["Erro ao reconciliar audiências de campanhas"], null)
    }
  }

  queueCampaignAudiencePrune(input: PruneInput): void {
    void emailCampaignAudiencePruningService
      .pruneSuppressedContacts(input)
      .catch((error) => {
        console.error("[EmailCampaignAudiencePruneUseCase][queueCampaignAudiencePrune]", error)
      })
  }

  queuePruneForSuppressedEmail(email: string): void {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return

    void (async () => {
      const teamIds = await emailCampaignAudienceRepository.findTeamIdsForSuppressedEmail(normalized)
      for (const teamId of teamIds) {
        await emailCampaignAudiencePruningService.pruneSuppressedContacts({
          teamId,
          emails: [normalized],
        })
      }
    })().catch((error) => {
      console.error("[EmailCampaignAudiencePruneUseCase][queuePruneForSuppressedEmail]", error)
    })
  }

  queuePruneForComplaint(email: string): void {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return

    void (async () => {
      const teamIds = await emailCampaignAudienceRepository.findTeamIdsWithEmailLogs(normalized)
      for (const teamId of teamIds) {
        await emailCampaignAudiencePruningService.pruneSuppressedContacts({
          teamId,
          emails: [normalized],
        })
      }
    })().catch((error) => {
      console.error("[EmailCampaignAudiencePruneUseCase][queuePruneForComplaint]", error)
    })
  }
}

export const emailCampaignAudiencePruneUseCase = new EmailCampaignAudiencePruneUseCase()

export type { CampaignAudiencePruneResult }
