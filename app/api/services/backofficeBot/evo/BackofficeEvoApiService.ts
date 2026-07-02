import type {
  BackofficeEvoConnectResult,
  IBackofficeEvoApiService,
} from "./IBackofficeEvoApiService";

/**
 * Cliente Evolution API dedicado ao módulo backoffice (Bethânia).
 * Duplicado a partir de app/api/services/whatsapp/evo/EvoApiService.ts por isolamento
 * de módulo (agents.md) — backoffice não deve importar services de produto.
 */

function getBaseUrl(): string {
  const envUrl = process.env.EVO_API_BASE_URL;
  if (!envUrl) throw new Error("[BackofficeEvoApiService] EVO_API_BASE_URL is not set");
  return envUrl.replace(/\/$/, "");
}

function getApiKey(): string {
  const key = process.env.EVO_API_KEY;
  if (!key) throw new Error("[BackofficeEvoApiService] EVO_API_KEY is not set");
  return key;
}

function buildHeaders(apiKey: string): HeadersInit {
  return { "Content-Type": "application/json", apikey: apiKey };
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;

async function fetchEvo<T>(url: string, options: RequestInit, label: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    console.error(`[BackofficeEvoApiService][${label}] Network error`, error);
    throw new Error(`[BackofficeEvoApiService][${label}] Network request failed: ${String(error)}`);
  }

  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      // ignore body read errors
    }
    console.error(`[BackofficeEvoApiService][${label}] HTTP ${response.status}`, body);
    throw new Error(`[BackofficeEvoApiService][${label}] HTTP ${response.status}: ${body}`);
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    console.error(`[BackofficeEvoApiService][${label}] Failed to parse JSON response`, error);
    throw new Error(`[BackofficeEvoApiService][${label}] Invalid JSON response`);
  }
}

async function fetchEvoWithRetry<T>(url: string, options: RequestInit, label: string): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchEvo<T>(url, options, label);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const statusMatch = lastError.message.match(/HTTP (\d+)/);
      const status = statusMatch ? Number(statusMatch[1]) : 0;
      const isNetworkError = !statusMatch;
      const isRetryable = isNetworkError || RETRYABLE_STATUS.has(status);

      if (!isRetryable || attempt === MAX_RETRIES) throw lastError;

      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.info(`[BackofficeEvoApiService][${label}] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError!;
}

function isInstanceNameAlreadyInUseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("403") && message.includes("already in use");
}

function buildWebhookPayload(webhookUrl: string) {
  return {
    enabled: true,
    url: webhookUrl,
    events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
  };
}

function normalizeStatus(raw: string | undefined): "open" | "close" | "connecting" {
  return raw === "open" || raw === "connecting" ? raw : "close";
}

interface EvoCreateInstanceResponse {
  instance?: { instanceName?: string; status?: string };
  qrcode?: { code?: string; base64?: string };
}

interface EvoConnectionStateResponse {
  instance?: { state?: string };
}

interface EvoFetchInstancesResponse {
  instance?: { instanceName?: string };
}

type EvoFetchInstancesListResponse = Array<{ name?: string; instanceName?: string }>;

interface EvoQrCodeResponse {
  code?: string;
  base64?: string;
}

export class BackofficeEvoApiService implements IBackofficeEvoApiService {
  private async createInstance(params: { instanceName: string; webhookUrl: string }) {
    const url = `${getBaseUrl()}/instance/create`;

    console.info("[BackofficeEvoApiService][createInstance] Creating instance", params.instanceName);

    const data = await fetchEvoWithRetry<EvoCreateInstanceResponse>(
      url,
      {
        method: "POST",
        headers: buildHeaders(getApiKey()),
        body: JSON.stringify({
          instanceName: params.instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook: buildWebhookPayload(params.webhookUrl),
        }),
      },
      "createInstance"
    );

    const instance = data.instance ?? {};
    const qrCode =
      data.qrcode?.code && data.qrcode?.base64
        ? { text: data.qrcode.code, base64: data.qrcode.base64 }
        : null;

    return {
      instanceName: instance.instanceName ?? params.instanceName,
      status: normalizeStatus(instance.status),
      qrCode,
    };
  }

  private async setWebhook(params: { instanceName: string; webhookUrl: string }): Promise<void> {
    const url = `${getBaseUrl()}/webhook/set/${encodeURIComponent(params.instanceName)}`;

    console.info("[BackofficeEvoApiService][setWebhook] Updating webhook for", params.instanceName);

    await fetchEvoWithRetry<unknown>(
      url,
      {
        method: "POST",
        headers: buildHeaders(getApiKey()),
        body: JSON.stringify({ webhook: buildWebhookPayload(params.webhookUrl) }),
      },
      "setWebhook"
    );
  }

  private async getConnectionState(instanceName: string): Promise<"open" | "close" | "connecting"> {
    const url = `${getBaseUrl()}/instance/connectionState/${encodeURIComponent(instanceName)}`;

    const data = await fetchEvoWithRetry<EvoConnectionStateResponse>(
      url,
      { method: "GET", headers: buildHeaders(getApiKey()) },
      "getConnectionState"
    );

    return normalizeStatus(data.instance?.state);
  }

  private async fetchInstance(instanceName: string): Promise<{ instanceName: string } | null> {
    const url = `${getBaseUrl()}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`;

    const data = await fetchEvoWithRetry<EvoFetchInstancesResponse | EvoFetchInstancesListResponse>(
      url,
      { method: "GET", headers: buildHeaders(getApiKey()) },
      "fetchInstance"
    );

    if (Array.isArray(data)) {
      const match = data.find(
        (item) => item.instanceName === instanceName || item.name === instanceName
      );
      return match ? { instanceName: match.instanceName ?? match.name ?? instanceName } : null;
    }

    return data.instance ? { instanceName: data.instance.instanceName ?? instanceName } : null;
  }

  private async getQrCode(instanceName: string): Promise<{ text: string; base64: string }> {
    const url = `${getBaseUrl()}/instance/connect/${encodeURIComponent(instanceName)}`;

    const data = await fetchEvoWithRetry<EvoQrCodeResponse>(
      url,
      { method: "GET", headers: buildHeaders(getApiKey()) },
      "getQrCode"
    );

    if (!data.code || !data.base64) {
      throw new Error(
        `[BackofficeEvoApiService][getQrCode] QR code not available for instance "${instanceName}"`
      );
    }

    return { text: data.code, base64: data.base64 };
  }

  async connectInstance(params: {
    instanceName: string;
    webhookUrl: string;
  }): Promise<BackofficeEvoConnectResult> {
    try {
      const created = await this.createInstance(params);
      return { instanceName: created.instanceName, status: created.status, qrCode: created.qrCode };
    } catch (error) {
      if (!isInstanceNameAlreadyInUseError(error)) {
        throw error;
      }

      console.info(
        "[BackofficeEvoApiService][connectInstance] Adopting existing instance",
        params.instanceName
      );

      const existing = await this.fetchInstance(params.instanceName);
      if (!existing) {
        throw error;
      }

      await this.setWebhook(params);
      const status = await this.getConnectionState(params.instanceName);

      let qrCode: { text: string; base64: string } | null = null;
      if (status !== "open") {
        try {
          qrCode = await this.getQrCode(params.instanceName);
        } catch (qrError) {
          console.error("[BackofficeEvoApiService][connectInstance] QR fetch failed", qrError);
        }
      }

      return { instanceName: existing.instanceName, status, qrCode };
    }
  }
}

/** Evolution retorna base64 com ou sem prefixo data-URL. */
export function toBackofficeQrCodeImageUrl(base64OrDataUrl: string): string {
  const trimmed = base64OrDataUrl.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  return `data:image/png;base64,${trimmed}`;
}

export const backofficeEvoApiService = new BackofficeEvoApiService();
