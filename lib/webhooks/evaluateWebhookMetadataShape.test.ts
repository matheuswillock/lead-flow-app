import { describe, expect, it } from "bun:test";
import { evaluateWebhookMetadataShape } from "./studioWebhookSecurity";

/** SPEC 10, A-E2/DA6 — T-10.8: metadata muito profundo ou muito grande vira
 * 400 controlado, nunca um 500 por estouro de pilha do scanner de SQLi. */
function buildNestedObject(depth: number): unknown {
  let current: unknown = { leaf: true };
  for (let i = 0; i < depth; i += 1) {
    current = { nested: current };
  }
  return current;
}

describe("evaluateWebhookMetadataShape (T-10.8)", () => {
  it("aceita metadata ausente", () => {
    expect(evaluateWebhookMetadataShape(undefined)).toEqual({ ok: true });
    expect(evaluateWebhookMetadataShape(null)).toEqual({ ok: true });
  });

  it("aceita metadata raso (dentro do teto de profundidade)", () => {
    expect(evaluateWebhookMetadataShape({ source: "zapier", campaign: "abc" })).toEqual({ ok: true });
  });

  it("T-10.8 — metadata com profundidade 50 → reprovado por profundidade, não estoura a pilha", () => {
    const deep = buildNestedObject(50);
    const result = evaluateWebhookMetadataShape(deep);
    expect(result).toEqual({ ok: false, reason: "too_deep" });
  });

  it("reprova metadata serializado maior que 8 KiB mesmo raso", () => {
    const big = { blob: "x".repeat(9 * 1024) };
    const result = evaluateWebhookMetadataShape(big);
    expect(result).toEqual({ ok: false, reason: "too_large" });
  });

  it("respeita overrides de maxDepth/maxBytes", () => {
    expect(evaluateWebhookMetadataShape({ a: { b: 1 } }, { maxDepth: 1 })).toEqual({
      ok: false,
      reason: "too_deep",
    });
    expect(evaluateWebhookMetadataShape({ a: 1 }, { maxBytes: 5 })).toEqual({
      ok: false,
      reason: "too_large",
    });
  });
});
