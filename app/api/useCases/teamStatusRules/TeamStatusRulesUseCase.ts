import { TeamStatusRuleType } from "@prisma/client";
import { Output } from "@/lib/output";
import type { ITeamStatusRuleService } from "@/app/api/services/teamStatusRule/ITeamStatusRuleService";
import { teamStatusRuleService } from "@/app/api/services/teamStatusRule/TeamStatusRuleService";
import type { ITeamStatusRulesUseCase, TeamStatusRuleSet } from "./ITeamStatusRulesUseCase";

export class TeamStatusRulesUseCase implements ITeamStatusRulesUseCase {
  constructor(private readonly service: ITeamStatusRuleService = teamStatusRuleService) {}

  async getRules(teamId: string): Promise<Output> {
    try {
      const rules = await this.service.listByTeam(teamId);

      const result: TeamStatusRuleSet = {
        disabledStatuses: rules
          .filter((rule) => rule.type === TeamStatusRuleType.disabled_status && rule.isEnabled)
          .map((rule) => rule.targetStatus),
        leadTimeRules: rules
          .filter((rule) => rule.type === TeamStatusRuleType.lead_time && rule.isEnabled)
          .map((rule) => ({
            status: rule.targetStatus,
            leadTimeValue: rule.leadTimeValue ?? 0,
            leadTimeUnit: rule.leadTimeUnit!,
          }))
          .filter((rule) => rule.leadTimeValue > 0),
        combinedRules: rules
          .filter((rule) => rule.type === TeamStatusRuleType.combined_transition)
          .map((rule) => ({
            id: rule.id,
            targetStatus: rule.targetStatus,
            requiredStatus: rule.requiredStatus!,
            requireConfirmation: rule.requireConfirmation,
            confirmationMessage: rule.confirmationMessage,
            isEnabled: rule.isEnabled,
          }))
          .filter((rule) => !!rule.requiredStatus),
      };

      return new Output(true, ["Regras carregadas com sucesso"], [], result);
    } catch (error) {
      console.error("[TeamStatusRulesUseCase][getRules] Erro ao carregar regras:", error);
      return new Output(false, [], ["Erro ao carregar regras do time"], null);
    }
  }

  async replaceRules(teamId: string, createdBy: string, input: TeamStatusRuleSet): Promise<Output> {
    try {
      const rules = await this.service.replaceByTeam(teamId, createdBy, input);
      return new Output(true, ["Regras atualizadas com sucesso"], [], rules);
    } catch (error) {
      console.error("[TeamStatusRulesUseCase][replaceRules] Erro ao atualizar regras:", error);
      return new Output(false, [], ["Erro ao atualizar regras do time"], null);
    }
  }
}

export const teamStatusRulesUseCase: ITeamStatusRulesUseCase = new TeamStatusRulesUseCase();

