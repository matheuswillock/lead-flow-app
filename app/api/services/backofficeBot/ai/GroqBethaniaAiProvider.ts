import { bethaniaAiResponseSchema } from "@/lib/studio-bot/ai/schemas";
import { toSafeBethaniaAiErrorCode } from "@/lib/studio-bot/ai/redaction";
import type {
  BethaniaAiGenerateInput,
  BethaniaAiGenerateResult,
  IBethaniaAiProvider,
} from "./IBethaniaAiProvider";

function resolveGroqApiKey(): string | null {
  return (
    process.env.BACKOFFICE_GROQ_API_KEY?.trim() ||
    process.env.GROQ_API_KEY?.trim() ||
    null
  );
}

function resolveGroqBaseUrl(): string {
  return (
    process.env.BACKOFFICE_BETHANIA_AI_BASE_URL?.trim() ||
    process.env.GROQ_API_BASE_URL?.trim() ||
    "https://api.groq.com/openai/v1"
  );
}

export class GroqBethaniaAiProvider implements IBethaniaAiProvider {
  readonly name = "groq" as const;

  async generate(input: BethaniaAiGenerateInput): Promise<BethaniaAiGenerateResult> {
    const apiKey = resolveGroqApiKey();
    if (!apiKey) return { ok: false, errorCode: "provider_not_configured", latencyMs: 0 };

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(input.timeoutMs, 8000));
    try {
      const response = await fetch(`${resolveGroqBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
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
      if (response.status === 429) {
        return { ok: false, errorCode: "rate_limited", latencyMs, httpStatus: 429 };
      }
      if (!response.ok) {
        return { ok: false, errorCode: "provider_error", latencyMs, httpStatus: response.status };
      }
      const payload = (await response.json()) as {
        id?: string;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return { ok: false, errorCode: "invalid_json", latencyMs, httpStatus: 200 };
      let rawContent: unknown;
      try {
        rawContent = JSON.parse(content);
      } catch {
        return { ok: false, errorCode: "invalid_json", latencyMs, httpStatus: 200 };
      }
      const parsed = bethaniaAiResponseSchema.safeParse(rawContent);
      return parsed.success
        ? {
            ok: true,
            response: parsed.data,
            latencyMs,
            inputTokens: payload.usage?.prompt_tokens,
            outputTokens: payload.usage?.completion_tokens,
            totalTokens: payload.usage?.total_tokens,
            httpStatus: 200,
            providerRequestId: payload.id,
          }
        : { ok: false, errorCode: "invalid_json", latencyMs, httpStatus: 200 };
    } catch (error) {
      return {
        ok: false,
        errorCode: toSafeBethaniaAiErrorCode(error),
        latencyMs: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const groqBethaniaAiProvider = new GroqBethaniaAiProvider();
