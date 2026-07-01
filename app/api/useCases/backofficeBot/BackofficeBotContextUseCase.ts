import { Output } from "@/lib/output";
import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";
import { botPolicyService } from "@/app/api/services/backofficeBot/BotPolicyService";
import { isManagerOrMaster } from "@/app/api/v1/utils/teamAccess";
import type { IBackofficeBotContextUseCase } from "./IBackofficeBotContextUseCase";

type MenuItem = { id: string; label: string; action: string };

const BASE_MENU: MenuItem[] = [
  { id: "list_leads", label: "Meus leads", action: "list_leads" },
  { id: "agenda_today", label: "Agenda de hoje", action: "agenda_today" },
  { id: "list_tasks", label: "Minhas tarefas", action: "list_tasks" },
];

export class BackofficeBotContextUseCase implements IBackofficeBotContextUseCase {
  async getContext(input: { userLinkId: string; teamId?: string | null }): Promise<Output> {
    try {
      const link = await backofficeBotRepository.findUserLinkById(input.userLinkId);
      if (!link || !link.isActive) {
        return new Output(false, [], ["Número não vinculado"], { errorCode: "AUTH_NOT_LINKED" });
      }

      const profile = await backofficeBotRepository.findProfileBotContext(link.profileId);
      if (!profile) {
        return new Output(false, [], ["Perfil não encontrado"], null);
      }

      const teamId = input.teamId ?? profile.activeTeamId;
      if (!teamId) {
        return new Output(false, [], ["Time ativo não encontrado"], null);
      }

      const teamMember = await backofficeBotRepository.findTeamMemberForBot(teamId, profile.id);
      if (!teamMember && !profile.isMaster) {
        return new Output(false, [], ["Acesso negado para este time"], { errorCode: "PERMISSION_DENIED" });
      }

      const session = await backofficeBotRepository.findActiveSession(link.id);
      const team = await backofficeBotRepository.findTeamName(teamId);

      const access = {
        supabaseId: link.profile.supabaseId ?? "",
        teamId,
        profileId: profile.id,
        profileEmail: link.profile.email,
        profileName: profile.fullName,
        isMaster: profile.isMaster,
        managerId: profile.id,
        canCreateAccountUsers: false,
        canManageAccountTeams: false,
        canTransferAccountLeads: false,
        canViewAllTeams: false,
        userTimezone: "America/Sao_Paulo",
        teamMember: teamMember ?? { role: "manager" as const, functions: [] },
      };

      const menuItems = [...BASE_MENU];
      if (botPolicyService.canViewTeamDigest({ access })) {
        menuItems.push(
          { id: "search_lead", label: "Buscar lead", action: "search_lead" },
          { id: "team_digest", label: "Resumo do time", action: "team_digest" }
        );
      }

      const firstName = profile.fullName?.split(" ")[0] ?? "usuário";
      return new Output(true, [], [], {
        menu: {
          title: `Olá, ${firstName}! Time: ${team?.name ?? "—"}`,
          items: menuItems,
        },
        session: session
          ? {
              id: session.id,
              teamId: session.teamId,
              currentLeadId: session.currentLeadId,
              flowId: session.flowId,
              flowStep: session.flowStep,
              expiresAt: session.expiresAt,
            }
          : null,
        permissions: botPolicyService.getRoleSummary(access.teamMember),
        canViewTeamDigest: isManagerOrMaster(access),
      });
    } catch (error) {
      console.error("[BackofficeBotContextUseCase][getContext]", error);
      return new Output(false, [], ["Erro ao montar contexto do menu"], null);
    }
  }
}

export const backofficeBotContextUseCase = new BackofficeBotContextUseCase();
