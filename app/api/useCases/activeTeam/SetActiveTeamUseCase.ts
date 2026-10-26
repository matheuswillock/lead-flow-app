import { Output } from "@/lib/output";
import type { ISetActiveTeamUseCase } from "./ISetActiveTeamUseCase";
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository";
import type { ITeamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/ITeamMembersRepository";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { teamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository";
import { accountAccessDecisionUseCase } from "@/app/api/useCases/accountAccessDecision/AccountAccessDecisionUseCase";
import type { AccountAccessDecisionInput } from "@/app/api/useCases/accountAccessDecision/AccountAccessDecisionUseCase";

export const SET_ACTIVE_TEAM_ERRORS = {
  PROFILE_NOT_FOUND: "PROFILE_NOT_FOUND",
  NOT_TEAM_MEMBER: "NOT_TEAM_MEMBER",
  ACCESS_UNRESOLVABLE: "ACCESS_UNRESOLVABLE",
} as const;

type ProfilePort = Pick<IProfileRepository, "findBySupabaseId" | "updateActiveTeamId">;

type TeamMembersPort = Pick<
  ITeamMembersRepository,
  "findMembershipTeamState" | "findSponsoredTeamAccess"
>;

type AccountAccessPort = {
  execute(input: AccountAccessDecisionInput): Promise<Output>;
};

export class SetActiveTeamUseCase implements ISetActiveTeamUseCase {
  constructor(
    private readonly profiles: ProfilePort = profileRepository,
    private readonly teamMembers: TeamMembersPort = teamMembersRepository,
    private readonly accountAccess: AccountAccessPort = accountAccessDecisionUseCase
  ) {}

  async execute(input: { supabaseId: string; teamId: string }): Promise<Output> {
    try {
      const profile = await this.profiles.findBySupabaseId(input.supabaseId);
      if (!profile) {
        return new Output(false, [], [SET_ACTIVE_TEAM_ERRORS.PROFILE_NOT_FOUND], null);
      }

      const membershipTeam = await this.teamMembers.findMembershipTeamState(
        input.teamId,
        profile.id
      );
      if (!membershipTeam || membershipTeam.deletedAt) {
        const sponsored = await this.teamMembers.findSponsoredTeamAccess(input.teamId);
        if (!sponsored || sponsored.sponsorMasterId !== profile.id) {
          return new Output(false, [], [SET_ACTIVE_TEAM_ERRORS.NOT_TEAM_MEMBER], null);
        }
      }

      const accountAccessOutput = await this.accountAccess.execute({
        profileId: profile.id,
        teamId: input.teamId,
      });
      if (!accountAccessOutput.isValid || !accountAccessOutput.result) {
        return new Output(false, [], [SET_ACTIVE_TEAM_ERRORS.ACCESS_UNRESOLVABLE], null);
      }

      await this.profiles.updateActiveTeamId(profile.id, input.teamId);

      return new Output(true, ["Active team updated"], [], {
        activeTeamId: input.teamId,
        accountAccessDecision: accountAccessOutput.result,
      });
    } catch (error) {
      console.error("[SetActiveTeamUseCase][execute]", error);
      return new Output(false, [], ["Erro ao atualizar o time ativo"], null);
    }
  }
}

export const setActiveTeamUseCase: ISetActiveTeamUseCase = new SetActiveTeamUseCase();
