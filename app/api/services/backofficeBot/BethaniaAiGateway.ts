import { groqBethaniaAiProvider } from "./ai/GroqBethaniaAiProvider";

/**
 * @deprecated Prefer BethaniaAiGatewayService — kept for existing unit tests.
 */
export class BethaniaAiGateway {
  async generate(input: { model: string; system: string; user: string; timeoutMs: number }) {
    return groqBethaniaAiProvider.generate(input);
  }
}

export const bethaniaAiGateway = new BethaniaAiGateway();
