import { Output } from "@/lib/output"
import { syncLeadToRadarUseCase } from "@/app/api/useCases/radar/SyncLeadToRadarUseCase"
import { syncPortfolioToRadarUseCase } from "@/app/api/useCases/radar/SyncPortfolioToRadarUseCase"
import { syncFinalizedToRadarUseCase } from "@/app/api/useCases/radar/SyncFinalizedToRadarUseCase"
import { syncRadarProfileDataForTeamUseCase } from "@/app/api/useCases/radar/SyncRadarProfileDataForTeamUseCase"
import type { RadarProfileSyncPayload } from "@/lib/queues/radar-profile-sync"

export type ProcessRadarProfileSyncDeps = {
  syncLead: Pick<typeof syncLeadToRadarUseCase, "execute">
  syncPortfolio: Pick<typeof syncPortfolioToRadarUseCase, "execute">
  syncFinalized: Pick<typeof syncFinalizedToRadarUseCase, "execute">
  syncProfileData: Pick<typeof syncRadarProfileDataForTeamUseCase, "execute">
}

const defaultDeps: ProcessRadarProfileSyncDeps = {
  syncLead: syncLeadToRadarUseCase,
  syncPortfolio: syncPortfolioToRadarUseCase,
  syncFinalized: syncFinalizedToRadarUseCase,
  syncProfileData: syncRadarProfileDataForTeamUseCase,
}

export class ProcessRadarProfileSyncUseCase {
  constructor(private readonly deps: ProcessRadarProfileSyncDeps = defaultDeps) {}

  async execute(payload: RadarProfileSyncPayload): Promise<Output> {
    switch (payload.source) {
      case "crm":
        if (!payload.sourceId) {
          return new Output(false, [], ["sourceId é obrigatório para source=crm"], null)
        }
        return this.deps.syncLead.execute({ leadId: payload.sourceId, teamId: payload.teamId })
      case "portfolio":
        if (!payload.sourceId) {
          return new Output(false, [], ["sourceId é obrigatório para source=portfolio"], null)
        }
        return this.deps.syncPortfolio.execute({
          portfolioId: payload.sourceId,
          teamId: payload.teamId,
        })
      case "finalized":
        return this.deps.syncFinalized.execute({
          teamId: payload.teamId,
          finalizedId: payload.sourceId,
          leadId: payload.leadId,
          leadIds: payload.leadIds,
        })
      case "email_settings":
      case "bulk_import_finalize":
        return this.deps.syncProfileData.execute({ teamId: payload.teamId })
      default: {
        const exhaustive: never = payload.source
        return new Output(false, [], [`source inválido: ${String(exhaustive)}`], null)
      }
    }
  }
}

export const processRadarProfileSyncUseCase = new ProcessRadarProfileSyncUseCase()
