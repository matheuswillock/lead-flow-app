import { createHmac } from "node:crypto";
import { config } from "../config.js";

const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [1_000, 3_000, 9_000];

type FetchFn = typeof fetch;
type DelayFn = (ms: number) => Promise<void>;

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WebhookDispatcher {
  private readonly fetchFn: FetchFn;
  private readonly delayFn: DelayFn;
  private readonly secret: string;

  constructor(opts?: { fetchFn?: FetchFn; delayFn?: DelayFn; secret?: string }) {
    this.fetchFn = opts?.fetchFn ?? fetch;
    this.delayFn = opts?.delayFn ?? defaultDelay;
    this.secret = opts?.secret ?? config.webhookSecret;
  }

  async send(webhookUrl: string, instance: string, event: string, data: unknown): Promise<void> {
    const body = JSON.stringify({ instance, event, data, timestamp: Date.now() });
    const signature = createHmac("sha256", this.secret).update(body).digest("hex");
    await this.sendWithRetry(webhookUrl, body, signature, event, 0);
  }

  private async sendWithRetry(
    webhookUrl: string,
    body: string,
    signature: string,
    event: string,
    attempt: number
  ): Promise<void> {
    try {
      const res = await this.fetchFn(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-openwa-signature": `sha256=${signature}`,
        },
        body,
      });

      if (res.ok) return;

      if (attempt < MAX_ATTEMPTS - 1) {
        console.info(`[WebhookDispatcher] ${event} HTTP ${res.status}, retry ${attempt + 1}/${MAX_ATTEMPTS - 1}`);
        await this.delayFn(RETRY_DELAYS_MS[attempt]);
        return this.sendWithRetry(webhookUrl, body, signature, event, attempt + 1);
      }
      console.error(`[WebhookDispatcher] ${event} falhou após ${MAX_ATTEMPTS} tentativas, HTTP ${res.status}`);
    } catch (err) {
      if (attempt < MAX_ATTEMPTS - 1) {
        console.info(`[WebhookDispatcher] ${event} network error, retry ${attempt + 1}/${MAX_ATTEMPTS - 1}`);
        await this.delayFn(RETRY_DELAYS_MS[attempt]);
        return this.sendWithRetry(webhookUrl, body, signature, event, attempt + 1);
      }
      console.error(`[WebhookDispatcher] ${event} falhou após ${MAX_ATTEMPTS} tentativas`, err);
      // Não lança — falha no webhook não pode derrubar a sessão
    }
  }
}
