import type {
  ITeamBillingSync,
  ITeamDeleter,
  ITeamDeletionSnapshotSource,
  ITeamMemberFollowUp,
  ITeamRemover,
  ITeamStorageCleaner,
  TeamDeletionResult,
} from "@/app/api/shared/teamDeletion/teamDeletionTypes"

/**
 * Exclusão definitiva do time e o que vem depois: usuários que só estavam nele perdem o acesso, os
 * arquivos dele saem do armazenamento e a cobrança é recalculada. Só a exclusão em si é obrigatória:
 * falha nas demais etapas é registrada e não desfaz nada.
 */
export class TeamDeletionService implements ITeamDeleter {
  constructor(
    private readonly snapshots: ITeamDeletionSnapshotSource,
    private readonly teamRemover: ITeamRemover,
    private readonly memberFollowUp: ITeamMemberFollowUp,
    private readonly storageCleaner: ITeamStorageCleaner,
    private readonly billing: ITeamBillingSync,
  ) {}

  async deleteNow(input: {
    teamId: string
    actorProfileId: string
    billingOwnerId: string
  }): Promise<TeamDeletionResult> {
    const snapshot = await this.snapshots.snapshot(input.teamId)
    const result: TeamDeletionResult = { leads: snapshot.leadCount, members: snapshot.memberCount }

    const output = await this.teamRemover.deleteTeam(input.teamId, input.actorProfileId, result)
    if (!output.isValid) {
      throw new Error(output.errorMessages[0] ?? "Erro interno ao deletar time")
    }

    await this.safely("tratar usuários", () =>
      this.memberFollowUp.handleTeamDeleted({ teamId: input.teamId, memberProfileIds: snapshot.memberProfileIds }),
    )
    await this.safely("apagar arquivos", () => this.storageCleaner.removeFiles(snapshot.storagePaths))
    await this.safely("recalcular cobrança", () =>
      this.billing.syncBillingAfterUsageChange(input.billingOwnerId, "remove_team"),
    )
    return result
  }

  private async safely(step: string, run: () => Promise<unknown>): Promise<void> {
    try {
      await run()
    } catch (error) {
      console.error(`[TeamDeletionService] falha ao ${step}`, {
        message: error instanceof Error ? error.message : "unknown",
      })
    }
  }
}
