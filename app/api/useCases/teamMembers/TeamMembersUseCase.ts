import { NotificationType, type UserFunction } from "@prisma/client";
import { Output } from "@/lib/output";
import { isGoogleConnectionActive } from "@/lib/google/connection";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { TeamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository";
import type { ITeamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/ITeamMembersRepository";

type ListMembersFunction = Extract<UserFunction, "SDR" | "CLOSER">;

function getDisplayName(profile: { fullName: string | null; email: string | null }) {
  return profile.fullName || profile.email || "Usuário";
}

export class TeamMembersUseCase {
  constructor(private readonly repository: ITeamMembersRepository) {}

  async listMembers(
    supabaseId: string,
    teamId: string,
    requestedFunction: ListMembersFunction | null
  ): Promise<Output> {
    try {
      const profile = await this.repository.findRequesterProfile(supabaseId);
      if (!profile) {
        return new Output(false, [], ["Perfil não encontrado"], null);
      }

      const [team, membership] = await Promise.all([
        this.repository.findTeam(teamId),
        this.repository.findMembership(teamId, profile.id),
      ]);

      if (!team) {
        return new Output(false, [], ["Time não encontrado"], null);
      }

      if (!membership) {
        return new Output(false, [], ["Você não faz parte deste time"], null);
      }

      const members = await this.repository.findMembers(teamId);
      const formattedMembers = members.map((member) => ({
        id: member.id,
        profileId: member.profileId,
        name: getDisplayName(member.profile),
        email: member.profile.email,
        role: member.role,
        functions: member.functions,
        googleCalendarConnected: isGoogleConnectionActive(member.profile.googleConnection),
        profileIconUrl: member.profile.profileIconUrl,
        isMaster: member.profileId === team.masterId,
      }));

      const filteredMembers = requestedFunction
        ? formattedMembers.filter((member) => member.functions.includes(requestedFunction))
        : formattedMembers;

      let eligibleProfiles: Array<{ id: string; name: string; email: string | null }> = [];
      let transferCandidates: Array<{ id: string; name: string; email: string | null }> = [];

      if (!requestedFunction) {
        const [masterTeamMembers, masterAccountProfiles] = await Promise.all([
          this.repository.findMasterAccountTeamMembers(team.masterId),
          this.repository.findMasterAccountProfiles(team.masterId),
        ]);

        const currentMemberIds = new Set(members.map((member) => member.profileId));
        eligibleProfiles = masterAccountProfiles
          .filter((accountProfile) => accountProfile.supabaseId)
          .filter((accountProfile) => !currentMemberIds.has(accountProfile.id))
          .map((accountProfile) => ({
            id: accountProfile.id,
            name: getDisplayName(accountProfile),
            email: accountProfile.email,
          }))
          .sort((a, b) => {
            const aKey = (a.name || a.email || "").toLowerCase();
            const bKey = (b.name || b.email || "").toLowerCase();
            return aKey.localeCompare(bKey, "pt-BR");
          });

        transferCandidates = masterTeamMembers
          .filter((member) => member.profile?.supabaseId)
          .filter((member) => member.profileId !== team.masterId)
          .map((member) => ({
            id: member.profile.id,
            name: getDisplayName(member.profile),
            email: member.profile.email,
          }));
      }

      return new Output(true, [], [], {
        team: { id: team.id, name: team.name, masterId: team.masterId },
        members: filteredMembers,
        eligibleProfiles,
        transferCandidates,
      });
    } catch (error) {
      console.error("[TeamMembersUseCase][listMembers] Erro ao listar membros do time:", error);
      return new Output(false, [], ["Erro interno ao listar membros do time"], null);
    }
  }

  async addMember(supabaseId: string, teamId: string, profileId: string): Promise<Output> {
    try {
      const profile = await this.repository.findRequesterProfile(supabaseId);
      if (!profile) {
        return new Output(false, [], ["Perfil não encontrado"], null);
      }

      const team = await this.repository.findTeam(teamId);
      if (!team) {
        return new Output(false, [], ["Time não encontrado"], null);
      }

      if (team.masterId !== profile.id) {
        return new Output(false, [], ["Apenas o master do time pode adicionar membros"], null);
      }

      const existingMember = await this.repository.findExistingMember(teamId, profileId);
      if (existingMember) {
        return new Output(false, [], ["Usuário já pertence ao time"], null);
      }

      const eligibleProfile = await this.repository.findEligibleProfile(profileId, team.masterId);
      if (!eligibleProfile) {
        return new Output(false, [], ["Usuário não pertence à conta deste master"], null);
      }

      if (!eligibleProfile.supabaseId) {
        return new Output(false, [], ["Usuário precisa ter conta ativa no sistema"], null);
      }

      const newMember = await this.repository.createMember({
        teamId,
        profileId,
        role: eligibleProfile.role,
        functions: eligibleProfile.functions ?? [],
      });

      try {
        await notificationService.createTeamMembershipNotification({
          teamId,
          actorProfileId: profile.id,
          actorName: getDisplayName(profile),
          teamName: team.name,
          recipientProfileId: profileId,
          type: NotificationType.TEAM_MEMBER_ADDED,
        });
      } catch (notificationError) {
        console.error("[TeamMembersUseCase][addMember] Erro ao criar notificação de membro adicionado:", notificationError);
      }

      return new Output(true, ["Membro adicionado com sucesso"], [], newMember);
    } catch (error) {
      console.error("[TeamMembersUseCase][addMember] Erro ao adicionar membro:", error);
      return new Output(false, [], ["Erro interno ao adicionar membro"], null);
    }
  }

  async removeMember(supabaseId: string, teamId: string, profileId: string): Promise<Output> {
    try {
      const profile = await this.repository.findRequesterProfile(supabaseId);
      if (!profile) {
        return new Output(false, [], ["Perfil não encontrado"], null);
      }

      const team = await this.repository.findTeam(teamId);
      if (!team) {
        return new Output(false, [], ["Time não encontrado"], null);
      }

      if (team.masterId !== profile.id) {
        return new Output(false, [], ["Apenas o master do time pode remover membros"], null);
      }

      if (profileId === team.masterId) {
        return new Output(false, [], ["Não é possível remover o master do time"], null);
      }

      try {
        await notificationService.createTeamMembershipNotification({
          teamId,
          actorProfileId: profile.id,
          actorName: getDisplayName(profile),
          teamName: team.name,
          recipientProfileId: profileId,
          type: NotificationType.TEAM_MEMBER_REMOVED,
        });
      } catch (notificationError) {
        console.error("[TeamMembersUseCase][removeMember] Erro ao criar notificação de membro removido:", notificationError);
      }

      await this.repository.deleteMember(teamId, profileId);

      return new Output(true, ["Membro removido com sucesso"], [], null);
    } catch (error) {
      console.error("[TeamMembersUseCase][removeMember] Erro ao remover membro:", error);
      return new Output(false, [], ["Erro interno ao remover membro"], null);
    }
  }
}

export const teamMembersUseCase = new TeamMembersUseCase(new TeamMembersRepository());
