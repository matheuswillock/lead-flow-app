import { API_CLIENT_BASE } from "@/lib/route-map";
import type { ITeamScheduleSettingsService } from "./ITeamScheduleSettingsService";
import type { TeamMeetingDurationMinutes, TeamScheduleSettings } from "../types";

type OutputResponse = {
  isValid: boolean;
  errorMessages?: string[];
  result?: TeamScheduleSettings;
};

export class TeamScheduleSettingsService implements ITeamScheduleSettingsService {
  async get(input: { supabaseId: string; teamId: string }): Promise<TeamScheduleSettings> {
    return this.request(input, "GET");
  }

  async update(input: {
    supabaseId: string;
    teamId: string;
    durationMinutes: TeamMeetingDurationMinutes;
  }): Promise<TeamScheduleSettings> {
    return this.request(input, "PUT");
  }

  private async request(
    input: { supabaseId: string; teamId: string; durationMinutes?: TeamMeetingDurationMinutes },
    method: "GET" | "PUT"
  ): Promise<TeamScheduleSettings> {
    const response = await fetch(`${API_CLIENT_BASE}/teams/${encodeURIComponent(input.teamId)}/schedule-settings`, {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": input.supabaseId,
        "x-team-id": input.teamId,
      },
      body: method === "PUT" ? JSON.stringify({ durationMinutes: input.durationMinutes }) : undefined,
    });
    const output = (await response.json().catch(() => null)) as OutputResponse | null;
    if (!response.ok || !output?.isValid || !output.result) {
      throw new Error(output?.errorMessages?.[0] ?? "Não foi possível carregar a configuração de agendamento.");
    }
    return output.result;
  }
}

export const teamScheduleSettingsService = new TeamScheduleSettingsService();
