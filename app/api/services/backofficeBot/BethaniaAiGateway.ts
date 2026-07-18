import { bethaniaAiResponseSchema, type BethaniaAiResponse } from "@/lib/studio-bot/ai/schemas";
import { toSafeBethaniaAiErrorCode } from "@/lib/studio-bot/ai/redaction";

type GenerateInput = { model: string; system: string; user: string; timeoutMs: number };
type GenerateResult =
  | { ok: true; response: BethaniaAiResponse; latencyMs: number }
  | { ok: false; errorCode: string; latencyMs: number };

/**
 * Small OpenAI-compatible boundary for Groq. It deliberately owns no business
 * policy: callers must run kill-switch, rollout, quota and circuit checks first.
 */
export class BethaniaAiGateway {
  async generate(input: GenerateInput): Promise<GenerateResult> {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) return { ok: false, errorCode: "provider_not_configured", latencyMs: 0 };

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(input.timeoutMs, 8000));
    try {
      const response = await fetch(`${process.env.GROQ_API_BASE_URL ?? "https://api.groq.com/openai/v1"}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: input.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
        }),
      });
      const latencyMs = Date.now() - startedAt;
      if (response.status === 429) return { ok: false, errorCode: "rate_limited", latencyMs };
      if (!response.ok) return { ok: false, errorCode: "provider_error", latencyMs };
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return { ok: false, errorCode: "invalid_json", latencyMs };
      let rawContent: unknown;
      try {
        rawContent = JSON.parse(content);
      } catch {
        return { ok: false, errorCode: "invalid_json", latencyMs };
      }
      const parsed = bethaniaAiResponseSchema.safeParse(rawContent);
      return parsed.success
        ? { ok: true, response: parsed.data, latencyMs }
        : { ok: false, errorCode: "invalid_json", latencyMs };
    } catch (error) {
      return { ok: false, errorCode: toSafeBethaniaAiErrorCode(error), latencyMs: Date.now() - startedAt };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const bethaniaAiGateway = new BethaniaAiGateway();
