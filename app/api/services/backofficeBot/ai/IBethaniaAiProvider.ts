import type { BethaniaAiResponse } from "@/lib/studio-bot/ai/schemas";

export type BethaniaAiGenerateInput = {
  model: string;
  system: string;
  user: string;
  timeoutMs: number;
};

export type BethaniaAiGenerateResult =
  | {
      ok: true;
      response: BethaniaAiResponse;
      latencyMs: number;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      httpStatus?: number;
      providerRequestId?: string;
    }
  | {
      ok: false;
      errorCode: string;
      latencyMs: number;
      httpStatus?: number;
    };

export interface IBethaniaAiProvider {
  readonly name: "groq" | "ollama";
  generate(input: BethaniaAiGenerateInput): Promise<BethaniaAiGenerateResult>;
}
