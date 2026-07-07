import { Output } from "@/lib/output";
import type { ITeamAutomationRuleService } from "@/app/api/services/teamAutomation/ITeamAutomationRuleService";
import { teamAutomationRuleService } from "@/app/api/services/teamAutomation/TeamAutomationRuleService";
import type {
  AutomationRuleInput,
  AutomationRuleUpdateInput,
} from "@/lib/team-automation/types";
import type { ITeamAutomationRulesUseCase } from "./ITeamAutomationRulesUseCase";

export class TeamAutomationRulesUseCase implements ITeamAutomationRulesUseCase {
  constructor(private readonly service: ITeamAutomationRuleService = teamAutomationRuleService) {}

  async list(teamId: string): Promise<Output> {
    try {
      const rules = await this.service.listByTeam(teamId);
      return new Output(true, [], [], rules);
    } catch (error) {
      console.error("[TeamAutomationRulesUseCase][list] Erro:", error);
      return new Output(false, [], ["Erro ao listar automações"], null);
    }
  }

  async create(teamId: string, profileId: string, input: AutomationRuleInput): Promise<Output> {
    try {
      const rule = await this.service.create(teamId, profileId, input);
      return new Output(true, ["Automação criada com sucesso"], [], rule);
    } catch (error) {
      console.error("[TeamAutomationRulesUseCase][create] Erro:", error);
      const message = error instanceof Error ? error.message : "Erro ao criar automação";
      return new Output(false, [], [message], null);
    }
  }

  async update(teamId: string, ruleId: string, input: AutomationRuleUpdateInput): Promise<Output> {
    try {
      const rule = await this.service.update(teamId, ruleId, input);
      if (!rule) {
        return new Output(false, [], ["Automação não encontrada"], null);
      }
      return new Output(true, ["Automação atualizada com sucesso"], [], rule);
    } catch (error) {
      console.error("[TeamAutomationRulesUseCase][update] Erro:", error);
      const message = error instanceof Error ? error.message : "Erro ao atualizar automação";
      return new Output(false, [], [message], null);
    }
  }

  async remove(teamId: string, ruleId: string): Promise<Output> {
    try {
      const removed = await this.service.remove(teamId, ruleId);
      if (!removed) {
        return new Output(false, [], ["Automação não encontrada"], null);
      }
      return new Output(true, ["Automação removida com sucesso"], [], { id: ruleId });
    } catch (error) {
      console.error("[TeamAutomationRulesUseCase][remove] Erro:", error);
      return new Output(false, [], ["Erro ao remover automação"], null);
    }
  }

  async toggle(teamId: string, ruleId: string, isEnabled: boolean): Promise<Output> {
    try {
      const rule = await this.service.toggle(teamId, ruleId, isEnabled);
      if (!rule) {
        return new Output(false, [], ["Automação não encontrada"], null);
      }
      return new Output(
        true,
        [isEnabled ? "Automação habilitada" : "Automação desabilitada"],
        [],
        rule
      );
    } catch (error) {
      console.error("[TeamAutomationRulesUseCase][toggle] Erro:", error);
      return new Output(false, [], ["Erro ao alterar status da automação"], null);
    }
  }

  async listRuns(
    teamId: string,
    ruleId: string,
    page: number,
    pageSize: number
  ): Promise<Output> {
    try {
      const existing = await this.service.findById(teamId, ruleId);
      if (!existing) {
        return new Output(false, [], ["Automação não encontrada"], null);
      }
      const result = await this.service.listRuns(teamId, ruleId, page, pageSize);
      return new Output(true, [], [], {
        items: result.items,
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
      });
    } catch (error) {
      console.error("[TeamAutomationRulesUseCase][listRuns] Erro:", error);
      return new Output(false, [], ["Erro ao listar execuções"], null);
    }
  }
}

export const teamAutomationRulesUseCase = new TeamAutomationRulesUseCase();
