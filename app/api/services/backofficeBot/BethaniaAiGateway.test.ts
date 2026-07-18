import { afterEach, describe, expect, test } from "bun:test";
import { BethaniaAiGateway } from "./BethaniaAiGateway";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.GROQ_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) {
    delete process.env.GROQ_API_KEY;
  } else {
    process.env.GROQ_API_KEY = originalApiKey;
  }
});

describe("BethaniaAiGateway", () => {
  test("classifies non-JSON model content as invalid_json", async () => {
    process.env.GROQ_API_KEY = "test-key";
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "not JSON" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const result = await new BethaniaAiGateway().generate({
      model: "test-model",
      system: "system",
      user: "user",
      timeoutMs: 1000,
    });

    expect(result).toMatchObject({ ok: false, errorCode: "invalid_json" });
  });
});
