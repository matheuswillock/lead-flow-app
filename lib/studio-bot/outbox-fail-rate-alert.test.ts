import { describe, expect, test } from "bun:test";
import { evaluateStudioBotOutboxFailRate } from "./outbox-fail-rate-alert";

describe("outbox-fail-rate-alert", () => {
  test("não alerta abaixo do mínimo de despachos", () => {
    expect(evaluateStudioBotOutboxFailRate({ dispatched: 4, failed: 4 })).toEqual({
      shouldAlert: false,
      failRate: 0,
    });
  });

  test("alerta em >=10% com dispatched >=5", () => {
    const result = evaluateStudioBotOutboxFailRate({ dispatched: 10, failed: 1 });
    expect(result.shouldAlert).toBe(true);
    expect(result.failRate).toBe(0.1);
  });

  test("não alerta abaixo de 10%", () => {
    const result = evaluateStudioBotOutboxFailRate({ dispatched: 20, failed: 1 });
    expect(result.shouldAlert).toBe(false);
    expect(result.failRate).toBe(0.05);
  });
});
