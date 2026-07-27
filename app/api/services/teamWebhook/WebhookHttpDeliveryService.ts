import type { TeamWebhookDestinationPreset } from "@prisma/client";
import { assertSafeWebhookTargetUrl } from "@/lib/webhooks/ssrfUrlGuard";

export type WebhookHttpDeliveryResult = {
  ok: boolean;
  statusCode: number | null;
  responseBody: unknown;
  errorMessage: string | null;
};

export interface IWebhookHttpDeliveryService {
  deliver(args: {
    targetUrl: string;
    preset: TeamWebhookDestinationPreset;
    body: unknown;
    timeoutMs?: number;
  }): Promise<WebhookHttpDeliveryResult>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export class WebhookHttpDeliveryService implements IWebhookHttpDeliveryService {
  async deliver(args: {
    targetUrl: string;
    preset: TeamWebhookDestinationPreset;
    body: unknown;
    timeoutMs?: number;
  }): Promise<WebhookHttpDeliveryResult> {
    const guard = assertSafeWebhookTargetUrl(args.targetUrl);
    if (!guard.ok) {
      return {
        ok: false,
        statusCode: null,
        responseBody: null,
        errorMessage: guard.reason,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), args.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(guard.url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "CorretorStudio-Webhook/1.0",
          "X-Corretor-Studio-Preset": args.preset,
        },
        body: JSON.stringify(args.body),
        signal: controller.signal,
        redirect: "error",
      });

      const text = await response.text().catch(() => "");
      let responseBody: unknown = text;
      try {
        responseBody = text ? JSON.parse(text) : null;
      } catch {
        responseBody = text.slice(0, 2000);
      }

      return {
        ok: response.ok,
        statusCode: response.status,
        responseBody,
        errorMessage: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? "Timeout ao entregar webhook"
            : error.message
          : "Erro ao entregar webhook";
      return {
        ok: false,
        statusCode: null,
        responseBody: null,
        errorMessage: message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const webhookHttpDeliveryService = new WebhookHttpDeliveryService();
