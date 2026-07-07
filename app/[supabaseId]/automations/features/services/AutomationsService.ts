import type { IAutomationsService } from "./IAutomationsService";
import type { AutomationRule, AutomationRuleFormInput, AutomationRunsPage } from "../context/AutomationsTypes";

type ApiOutput<T> = {
  isValid: boolean;
  errorMessages: string[];
  result: T;
};

async function parseOutput<T>(response: Response): Promise<T> {
  const data = (await response.json()) as ApiOutput<T>;
  if (!response.ok || !data.isValid) {
    throw new Error(data.errorMessages?.[0] ?? "Erro na requisição");
  }
  return data.result;
}

function headers(supabaseId: string, teamId: string) {
  return {
    "Content-Type": "application/json",
    "x-supabase-user-id": supabaseId,
    "x-team-id": teamId,
  };
}

export class AutomationsService implements IAutomationsService {
  async listRules(supabaseId: string, teamId: string) {
    const response = await fetch(`/api/v1/teams/${teamId}/automations`, {
      headers: headers(supabaseId, teamId),
    });
    return parseOutput<AutomationRule[]>(response);
  }

  async createRule(supabaseId: string, teamId: string, input: AutomationRuleFormInput) {
    const response = await fetch(`/api/v1/teams/${teamId}/automations`, {
      method: "POST",
      headers: headers(supabaseId, teamId),
      body: JSON.stringify(input),
    });
    return parseOutput<AutomationRule>(response);
  }

  async updateRule(
    supabaseId: string,
    teamId: string,
    ruleId: string,
    input: Partial<AutomationRuleFormInput>
  ) {
    const response = await fetch(`/api/v1/teams/${teamId}/automations/${ruleId}`, {
      method: "PATCH",
      headers: headers(supabaseId, teamId),
      body: JSON.stringify(input),
    });
    return parseOutput<AutomationRule>(response);
  }

  async deleteRule(supabaseId: string, teamId: string, ruleId: string) {
    const response = await fetch(`/api/v1/teams/${teamId}/automations/${ruleId}`, {
      method: "DELETE",
      headers: headers(supabaseId, teamId),
    });
    await parseOutput<{ id: string }>(response);
  }

  async toggleRule(supabaseId: string, teamId: string, ruleId: string, isEnabled: boolean) {
    const response = await fetch(`/api/v1/teams/${teamId}/automations/${ruleId}/toggle`, {
      method: "POST",
      headers: headers(supabaseId, teamId),
      body: JSON.stringify({ isEnabled }),
    });
    return parseOutput<AutomationRule>(response);
  }

  async listRuns(supabaseId: string, teamId: string, ruleId: string, page = 1) {
    const response = await fetch(
      `/api/v1/teams/${teamId}/automations/${ruleId}/runs?page=${page}&pageSize=20`,
      { headers: headers(supabaseId, teamId) }
    );
    return parseOutput<AutomationRunsPage>(response);
  }
}

export const automationsService = new AutomationsService();
