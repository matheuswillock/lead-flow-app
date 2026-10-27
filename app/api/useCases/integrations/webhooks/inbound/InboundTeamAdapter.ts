import { accountAccessDecisionUseCase } from "@/app/api/useCases/accountAccessDecision/AccountAccessDecisionUseCase";
import type { AccountAccessDecision } from "@/app/api/shared/accountAccessDecision/types";
import { studioWebhookConfigRepository } from "@/app/api/infra/data/repositories/studioWebhook/StudioWebhookConfigRepository";
import type { IInboundTeamPort } from "./InboundIntakePorts";

/**
 * Contexto do time do webhook e decisão de acesso da conta. Fica fora de `InboundIntakeAdapters`
 * porque o recebimento síncrono só precisa disto, e importar os adaptadores de lead/agenda
 * arrastaria o `LeadUseCase` inteiro para a rota de recebimento.
 */
export const inboundTeamAdapter: IInboundTeamPort = {
  async getTeam(teamId) {
    const team = await studioWebhookConfigRepository.getTeamWithMaster(teamId);
    if (!team?.master.supabaseId) return null;
    return { teamId: team.id, managerProfileId: team.master.id, managerSupabaseId: team.master.supabaseId };
  },

  async isAccountAllowed(team) {
    const access = await accountAccessDecisionUseCase.execute({
      profileId: team.managerProfileId,
      teamId: team.teamId,
    });
    const decision = access.result as AccountAccessDecision | null;
    return access.isValid && decision?.state === "allowed";
  },
};
