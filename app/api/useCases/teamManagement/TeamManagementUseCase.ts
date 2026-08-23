import { Output } from "@/lib/output";
import { teamRepository } from "@/app/api/infra/data/repositories/team/TeamRepository";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { TeamUpdateError } from "@/app/api/infra/data/repositories/team/ITeamRepository";
import type { ITeamRepository } from "@/app/api/infra/data/repositories/team/ITeamRepository";
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository";
import { auditLogWriter } from "@/app/api/useCases/audit/AuditLogWriter";
import type { ITeamManagementUseCase, UpdateTeamInput } from "./ITeamManagementUseCase";

export const TEAM_MANAGEMENT_ERRORS = {
  NOT_FOUND: "Time não encontrado",
  ONLY_DEFAULT: "Selecione outro time como padrão antes de remover",
  PROFILE_NOT_FOUND: "Perfil não encontrado",
  UPDATE_FAILED: "Erro interno ao atualizar time",
  DELETE_FAILED: "Erro interno ao deletar time",
} as const;

export class TeamManagementUseCase implements ITeamManagementUseCase {
  constructor(
    private readonly teams: ITeamRepository,
    private readonly profiles: IProfileRepository
  ) {}

  async updateTeam(input: UpdateTeamInput): Promise<Output> {
    try {
      const updated = await this.teams.updateTeamWithTransferRoutes(input);

      await auditLogWriter.logAudit({
        entityType: "TEAM",
        entityId: input.teamId,
        action: "UPDATE",
        actorProfileId: input.actorProfileId,
        before: updated.before,
        after: updated.after,
        metadata: { teamId: input.teamId },
      });

      return new Output(true, ["Time atualizado com sucesso"], [], updated.after);
    } catch (error) {
      if (error instanceof TeamUpdateError) {
        const message =
          error.reason === "TEAM_NOT_FOUND"
            ? TEAM_MANAGEMENT_ERRORS.NOT_FOUND
            : TEAM_MANAGEMENT_ERRORS.ONLY_DEFAULT;
        return new Output(false, [], [message], null);
      }

      console.error("[TeamManagementUseCase][updateTeam] Erro:", error);
      return new Output(false, [], [TEAM_MANAGEMENT_ERRORS.UPDATE_FAILED], null);
    }
  }

  async findDeletionActors(supabaseId: string, managerId: string): Promise<Output> {
    try {
      const [requester, billingOwner] = await Promise.all([
        this.profiles.findAuthContactBySupabaseId(supabaseId),
        this.profiles.findIdentityById(managerId),
      ]);

      if (!requester || !billingOwner) {
        return new Output(false, [], [TEAM_MANAGEMENT_ERRORS.PROFILE_NOT_FOUND], null);
      }

      return new Output(true, [], [], {
        requesterId: requester.id,
        requesterEmail: requester.email,
        billingOwnerId: billingOwner.id,
      });
    } catch (error) {
      console.error("[TeamManagementUseCase][findDeletionActors] Erro:", error);
      return new Output(false, [], [TEAM_MANAGEMENT_ERRORS.DELETE_FAILED], null);
    }
  }

  async deleteTeam(teamId: string, actorProfileId: string): Promise<Output> {
    try {
      const snapshot = await this.teams.findAuditSnapshot(teamId);
      await this.teams.deleteTeam(teamId);

      await auditLogWriter.logAudit({
        entityType: "TEAM",
        entityId: teamId,
        action: "DELETE",
        actorProfileId,
        before: snapshot,
        after: null,
        metadata: { teamId },
      });

      return new Output(true, ["Time deletado com sucesso"], [], { teamId });
    } catch (error) {
      console.error("[TeamManagementUseCase][deleteTeam] Erro:", error);
      return new Output(false, [], [TEAM_MANAGEMENT_ERRORS.DELETE_FAILED], null);
    }
  }
}

export const teamManagementUseCase = new TeamManagementUseCase(teamRepository, profileRepository);
