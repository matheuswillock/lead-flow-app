import type { TeamWebhookDestinationPreset } from "@prisma/client";
import http from "node:http";
import https from "node:https";
import { assertSafeWebhookTargetUrlResolved } from "@/lib/webhooks/ssrfUrlGuard";

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
