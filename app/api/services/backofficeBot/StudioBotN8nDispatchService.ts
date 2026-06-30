import { signStudioBotPayload } from "@/lib/studio-bot/hmac";
import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";

export class StudioBotN8nDispatchService {
  private async resolveOutboundConfig() {
    const outboundUrl = process.env.BACKOFFICE_N8N_OUTBOUND_URL?.trim();
    if (!outboundUrl) {
      return null;
    }

    const channel = await backofficeBotRepository.getActiveChannel();
    const secret =
      channel?.n8nOutboundSecret ??
      process.env.BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET?.trim() ??
      "";

    return { outboundUrl, secret, channelId: channel?.id ?? null };
  }

  async sendTestPing(): Promise<{ ok: boolean; status: number }> {
    const config = await this.resolveOutboundConfig();
    if (!config) {
      return { ok: false, status: 0 };
    }

    const body = JSON.stringify({
      eventType: "studio_bot.test_ping",
      timestamp: new Date().toISOString(),
      channelId: config.channelId,
    });

    const response = await this.postSigned(config.outboundUrl, body, config.secret);
    return { ok: response.ok, status: response.status };
  }

  async dispatchEvent(
    payload: unknown,
    idempotencyKey: string
  ): Promise<{ ok: boolean; status: number }> {
    const config = await this.resolveOutboundConfig();
    if (!config) {
      return { ok: false, status: 0 };
    }

    const body = JSON.stringify(payload);
    const response = await this.postSigned(config.outboundUrl, body, config.secret, idempotencyKey);
    return { ok: response.ok, status: response.status };
  }

  private async postSigned(
    url: string,
    body: string,
    secret: string,
    idempotencyKey?: string
  ): Promise<Response> {
    const signature = signStudioBotPayload(body, secret);
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-studio-bot-signature": signature,
        ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
      },
      body,
    });
  }
}

export const studioBotN8nDispatchService = new StudioBotN8nDispatchService();
