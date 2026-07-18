import { signStudioBotPayload } from "@/lib/studio-bot/hmac";

export type HostAgentHealthResult = {
  ok: boolean;
  containers?: Array<{ name: string; status: string; image?: string }>;
  workflows?: Array<{ id: string; name: string; active: boolean }>;
  hostVersion?: string | null;
  error?: string;
};

export type HostAgentLogsResult = {
  ok: boolean;
  service?: "n8n" | "api";
  lines?: string[];
  fetchedAt?: string;
  error?: string;
};

export type HostAgentApplyEnvInput = {
  n8nEnv?: Record<string, string>;
  evolutionEnv?: Record<string, string>;
  recreateServices?: Array<"n8n" | "api">;
};

export type HostAgentRestartInput = {
  service: "n8n" | "api" | "all";
};

export type HostAgentSyncInput = {
  version: string;
  packBase64: string;
  packSha256: string;
};

export type HostAgentLogsInput = {
  service: "n8n" | "api";
  tail?: number;
};

export interface IStudioBotHostAgentClient {
  health(baseUrl: string, token: string): Promise<HostAgentHealthResult>;
  logs(
    baseUrl: string,
    token: string,
    input: HostAgentLogsInput
  ): Promise<HostAgentLogsResult>;
  applyEnv(
    baseUrl: string,
    token: string,
    input: HostAgentApplyEnvInput
  ): Promise<{ ok: boolean; detail?: unknown; error?: string }>;
  restart(
    baseUrl: string,
    token: string,
    input: HostAgentRestartInput
  ): Promise<{ ok: boolean; detail?: unknown; error?: string }>;
  importWorkflows(
    baseUrl: string,
    token: string
  ): Promise<{ ok: boolean; detail?: unknown; error?: string }>;
  syncHost(
    baseUrl: string,
    token: string,
    input: HostAgentSyncInput
  ): Promise<{ ok: boolean; detail?: unknown; error?: string }>;
}

function agentHeaders(token: string, body: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-studio-bot-signature": signStudioBotPayload(body, token),
  };
}

async function postJson(
  baseUrl: string,
  token: string,
  path: string,
  payload: unknown
): Promise<{ ok: boolean; detail?: unknown; error?: string; status: number }> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const body = JSON.stringify(payload ?? {});
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: agentHeaders(token, body),
      body,
      signal: AbortSignal.timeout(120_000),
    });
    const text = await response.text();
    let detail: unknown = text;
    try {
      detail = text ? JSON.parse(text) : null;
    } catch {
      // keep text
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail,
        error: typeof detail === "object" && detail && "error" in detail
          ? String((detail as { error: unknown }).error)
          : `HTTP ${response.status}`,
      };
    }
    return { ok: true, status: response.status, detail };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export class StudioBotHostAgentClient implements IStudioBotHostAgentClient {
  async health(baseUrl: string, token: string): Promise<HostAgentHealthResult> {
    const url = `${baseUrl.replace(/\/$/, "")}/v1/health`;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-studio-bot-signature": signStudioBotPayload("", token),
        },
        signal: AbortSignal.timeout(30_000),
      });
      const detail = (await response.json().catch(() => null)) as HostAgentHealthResult | null;
      if (!response.ok || !detail) {
        return { ok: false, error: `HTTP ${response.status}` };
      }
      return detail;
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async logs(
    baseUrl: string,
    token: string,
    input: HostAgentLogsInput
  ): Promise<HostAgentLogsResult> {
    const tail = Math.min(Math.max(input.tail ?? 200, 1), 1000);
    const qs = new URLSearchParams({
      service: input.service,
      tail: String(tail),
    });
    const url = `${baseUrl.replace(/\/$/, "")}/v1/logs?${qs.toString()}`;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-studio-bot-signature": signStudioBotPayload("", token),
        },
        signal: AbortSignal.timeout(60_000),
      });
      const detail = (await response.json().catch(() => null)) as HostAgentLogsResult | null;
      if (!response.ok || !detail) {
        return { ok: false, error: `HTTP ${response.status}` };
      }
      return detail;
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  applyEnv(baseUrl: string, token: string, input: HostAgentApplyEnvInput) {
    return postJson(baseUrl, token, "/v1/env/apply", input);
  }

  restart(baseUrl: string, token: string, input: HostAgentRestartInput) {
    return postJson(baseUrl, token, "/v1/services/restart", input);
  }

  importWorkflows(baseUrl: string, token: string) {
    return postJson(baseUrl, token, "/v1/workflows/import", {});
  }

  syncHost(baseUrl: string, token: string, input: HostAgentSyncInput) {
    return postJson(baseUrl, token, "/v1/host/sync", input);
  }
}

export const studioBotHostAgentClient = new StudioBotHostAgentClient();
