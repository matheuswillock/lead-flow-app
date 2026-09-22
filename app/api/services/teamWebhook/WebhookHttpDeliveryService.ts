import type { TeamWebhookDestinationPreset } from "@prisma/client";
import http from "node:http";
import https from "node:https";
import { assertSafeWebhookTargetUrlResolved } from "@/lib/webhooks/ssrfUrlGuard";
import {
  computeWebhookSignature,
  WEBHOOK_EVENT_VERSION,
  WEBHOOK_EVENT_VERSION_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from "@/lib/webhooks/webhookSigningSecurity";

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
    /** Segredo de assinatura em texto puro, já descriptografado (DA1). */
    signingSecret?: string | null;
    timeoutMs?: number;
  }): Promise<WebhookHttpDeliveryResult>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export class WebhookHttpDeliveryService implements IWebhookHttpDeliveryService {
  async deliver(args: {
    targetUrl: string;
    preset: TeamWebhookDestinationPreset;
    body: unknown;
    signingSecret?: string | null;
    timeoutMs?: number;
  }): Promise<WebhookHttpDeliveryResult> {
    const guard = await assertSafeWebhookTargetUrlResolved(args.targetUrl);
    if (!guard.ok) {
      return {
        ok: false,
        statusCode: null,
        responseBody: null,
        errorMessage: guard.reason,
      };
    }

    const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const payload = JSON.stringify(args.body);
    const url = guard.url;
    const transport = url.protocol === "http:" ? http : https;
    const pinnedAddress = guard.pinnedAddress;
    const pinnedFamily = guard.pinnedFamily ?? 4;

    // DA1 — todo envio leva assinatura, timestamp e versão do envelope.
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signatureHeaders: Record<string, string> = {
      [WEBHOOK_EVENT_VERSION_HEADER]: String(WEBHOOK_EVENT_VERSION),
    };
    if (args.signingSecret) {
      signatureHeaders[WEBHOOK_TIMESTAMP_HEADER] = timestamp;
      signatureHeaders[WEBHOOK_SIGNATURE_HEADER] = computeWebhookSignature(
        args.signingSecret,
        timestamp,
        payload
      );
    } else {
      console.error(
        "[WebhookHttpDeliveryService] Entrega sem segredo de assinatura configurado"
      );
    }

    return new Promise((resolve) => {
      const request = transport.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
            "User-Agent": "CorretorStudio-Webhook/1.0",
            "X-Corretor-Studio-Preset": args.preset,
            ...signatureHeaders,
            Host: url.host,
          },
          // Pin validated DNS result to reduce rebinding between check and connect.
          ...(pinnedAddress
            ? {
                lookup: (
                  _hostname: string,
                  _options: unknown,
                  callback: (
                    err: NodeJS.ErrnoException | null,
                    address: string,
                    family: number
                  ) => void
                ) => {
                  callback(null, pinnedAddress, pinnedFamily);
                },
              }
            : {}),
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
          });
          response.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            let responseBody: unknown = text;
            try {
              responseBody = text ? JSON.parse(text) : null;
            } catch {
              responseBody = text.slice(0, 2000);
            }

            const statusCode = response.statusCode ?? 0;
            const ok = statusCode >= 200 && statusCode < 300;
            resolve({
              ok,
              statusCode,
              responseBody,
              errorMessage: ok ? null : `HTTP ${statusCode}`,
            });
          });
        }
      );

      request.setTimeout(timeoutMs, () => {
        request.destroy(new Error("Timeout ao entregar webhook"));
      });

      request.on("error", (error) => {
        const message =
          error instanceof Error
            ? error.message.includes("Timeout")
              ? "Timeout ao entregar webhook"
              : error.message
            : "Erro ao entregar webhook";
        resolve({
          ok: false,
          statusCode: null,
          responseBody: null,
          errorMessage: message,
        });
      });

      request.write(payload);
      request.end();
    });
  }
}

export const webhookHttpDeliveryService = new WebhookHttpDeliveryService();
