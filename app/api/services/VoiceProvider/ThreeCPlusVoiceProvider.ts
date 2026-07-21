import crypto from "crypto";
import { decryptDialerSecret } from "@/lib/dialer/secret-crypto";
import type {
  IVoiceProvider,
  VoiceProviderAgent,
  VoiceProviderCallRange,
  VoiceProviderCallSummary,
  VoiceProviderCampaignStatus,
  VoiceProviderContact,
  VoiceProviderRecording,
} from "./IVoiceProvider";

export type ThreeCPlusMode = "master" | "own_account";

export type ThreeCPlusVoiceProviderTeam = {
  dialer3cplusMode: ThreeCPlusMode;
  dialer3cplusApiToken: string | null;
};

const DEFAULT_API_BASE_URL = "https://app.3c.plus/api/v1";
const DEFAULT_AGENT_TIMEZONE = "America/Sao_Paulo";

type ThreeCPlusUser = {
  id: number;
  name: string;
  extension?: { extension_number: number } | null;
};

type ThreeCPlusTeam = {
  id: number;
  name: string;
  color: string;
  agents: ThreeCPlusUser[];
};

type ThreeCPlusCampaign = {
  id: number;
  paused: boolean;
};

type ThreeCPlusMailingList = {
  id: number;
};

type ThreeCPlusSingleCampaignStatistics = {
  answered?: number;
  not_answered?: number;
  abandoned?: number;
  failed?: number;
};

type ThreeCPlusCampaignStatistics = {
  data: ThreeCPlusSingleCampaignStatistics[];
};

type ThreeCPlusCallHistoryReport = {
  id: string;
  campaign_id: number | null;
  agent: string | null;
  has_agent: boolean;
  number: string;
  speaking_time: string;
  billed_time: string;
  billed_value: string;
  recording: string | null;
  call_date_rfc3339: string;
};

function resolveThreeCPlusApiToken(team: ThreeCPlusVoiceProviderTeam): string {
  if (team.dialer3cplusMode === "own_account") {
    const decryptedToken = decryptDialerSecret(team.dialer3cplusApiToken);
    if (!decryptedToken) {
      throw new Error(
        "[ThreeCPlusVoiceProvider] Time no modo own_account sem token 3C Plus configurado"
      );
    }
    return decryptedToken;
  }

  const masterToken = process.env.THREECPLUS_API_TOKEN?.trim();
  if (!masterToken) {
    throw new Error("[ThreeCPlusVoiceProvider] THREECPLUS_API_TOKEN não configurado para o modo master");
  }
  return masterToken;
}

export class ThreeCPlusVoiceProvider implements IVoiceProvider {
  private readonly apiBaseUrl: string;
  private readonly apiToken: string;
  private readonly mode: ThreeCPlusMode;

  constructor(team: ThreeCPlusVoiceProviderTeam) {
    this.mode = team.dialer3cplusMode;
    this.apiToken = resolveThreeCPlusApiToken(team);
    this.apiBaseUrl = process.env.THREECPLUS_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
  }

  private buildUrl(path: string, query: Record<string, string | string[] | undefined> = {}): URL {
    const url = new URL(`${this.apiBaseUrl}${path}`);
    url.searchParams.set("api_token", this.apiToken);

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(`${key}[]`, item);
        }
      } else {
        url.searchParams.set(key, value);
      }
    }

    return url;
  }

  private async requestJson<T>(
    path: string,
    options: { method?: string; query?: Record<string, string | string[] | undefined>; json?: unknown } = {}
  ): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers: { "Content-Type": "application/json" },
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    });

    return this.parseResponse<T>(response, options.method ?? "GET", path);
  }

  private async requestForm<T>(
    path: string,
    method: string,
    form: Record<string, string | string[] | undefined>
  ): Promise<T> {
    const url = this.buildUrl(path);
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(form)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          body.append(`${key}[]`, item);
        }
      } else {
        body.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    return this.parseResponse<T>(response, method, path);
  }

  private async parseResponse<T>(response: Response, method: string, path: string): Promise<T> {
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`[ThreeCPlusVoiceProvider] ${method} ${path} falhou (${response.status}): ${errorBody}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async createTeam(name: string): Promise<{ id: string }> {
    const team = await this.requestForm<ThreeCPlusTeam>("/teams", "POST", {
      name,
      color: "#4F46E5",
    });
    return { id: String(team.id) };
  }

  async createAgent(name: string, extensionNumber: number, email?: string | null): Promise<VoiceProviderAgent> {
    if (this.mode === "own_account") {
      throw new Error(
        "[ThreeCPlusVoiceProvider] createAgent não é aplicável no modo own_account — o Time gerencia os próprios usuários na conta 3C Plus"
      );
    }

    const user = await this.requestForm<ThreeCPlusUser>("/users", "POST", {
      name,
      extension_number: String(extensionNumber),
      password: crypto.randomBytes(16).toString("hex"),
      role: "agent",
      timezone: DEFAULT_AGENT_TIMEZONE,
      web_extension: "true",
      email: email ?? undefined,
    });

    return {
      id: String(user.id),
      extensionNumber: user.extension?.extension_number ?? extensionNumber,
    };
  }

  async assignAgentToTeam(agentId: string, teamId: string): Promise<void> {
    const team = await this.requestJson<ThreeCPlusTeam>(`/teams/${teamId}`);
    const existingAgentIds = team.agents.map((agent) => String(agent.id));
    const nextAgentIds = existingAgentIds.includes(agentId) ? existingAgentIds : [...existingAgentIds, agentId];

    await this.requestForm(`/teams/${teamId}`, "PUT", {
      name: team.name,
      color: team.color,
      agents: nextAgentIds,
    });
  }

  async syncCampaignContacts(
    campaignId: string,
    contacts: VoiceProviderContact[]
  ): Promise<{ listId: string; syncedCount: number }> {
    const list = await this.requestForm<ThreeCPlusMailingList>(`/campaigns/${campaignId}/lists`, "POST", {
      name: `lead-flow-${Date.now()}`,
    });

    const listId = String(list.id);

    await this.requestJson(`/campaigns/${campaignId}/lists/${listId}/mailing.json`, {
      method: "POST",
      json: contacts.map((contact) => ({
        phone: contact.phone,
        data: { name: contact.name, email: contact.email ?? undefined },
      })),
    });

    return { listId, syncedCount: contacts.length };
  }

  async startCampaign(campaignId: string): Promise<void> {
    await this.requestJson(`/campaigns/${campaignId}/resume`, { method: "PUT" });
  }

  async pauseCampaign(campaignId: string): Promise<void> {
    await this.requestJson(`/campaigns/${campaignId}/pause`, { method: "PUT" });
  }

  async getCampaignStatus(campaignId: string, range: VoiceProviderCallRange): Promise<VoiceProviderCampaignStatus> {
    const [campaign, statistics] = await Promise.all([
      this.requestJson<ThreeCPlusCampaign>(`/campaigns/${campaignId}`),
      this.requestJson<ThreeCPlusCampaignStatistics>(`/campaigns/${campaignId}/statistics`, {
        query: { startDate: range.startDate, endDate: range.endDate },
      }),
    ]);

    const totals = statistics.data.reduce(
      (acc, day) => ({
        answeredCalls: acc.answeredCalls + (day.answered ?? 0),
        notAnsweredCalls: acc.notAnsweredCalls + (day.not_answered ?? 0),
        abandonedCalls: acc.abandonedCalls + (day.abandoned ?? 0),
        failedCalls: acc.failedCalls + (day.failed ?? 0),
      }),
      { answeredCalls: 0, notAnsweredCalls: 0, abandonedCalls: 0, failedCalls: 0 }
    );

    return { id: String(campaign.id), paused: campaign.paused, ...totals };
  }

  async listCallsForCampaign(
    campaignId: string,
    range: VoiceProviderCallRange
  ): Promise<VoiceProviderCallSummary[]> {
    const reports = await this.requestJson<ThreeCPlusCallHistoryReport[]>("/calls", {
      query: {
        per_page: "100",
        start_date: range.startDate,
        end_date: range.endDate,
        campaigns: [campaignId],
      },
    });

    return reports.map((report) => ({
      providerCallId: report.id,
      campaignId: report.campaign_id !== null ? String(report.campaign_id) : null,
      agentName: report.agent,
      phone: report.number,
      speakingTime: report.speaking_time,
      billedTime: report.billed_time,
      billedValue: report.billed_value,
      hasAgent: report.has_agent,
      recordingUrl: report.recording,
      callDateRfc3339: report.call_date_rfc3339,
    }));
  }

  async getRecording(callId: string): Promise<VoiceProviderRecording> {
    const url = this.buildUrl(`/calls/${callId}/recording`);
    return { url: url.toString(), expiresAt: null };
  }
}
