import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

mock.module("server-only", () => ({}));

const attemptedTags: string[] = [];

/**
 * Simula o comportamento real do Next fora de um work store (scripts CLI, seeds,
 * workers): revalidateTag lanca "Invariant: static generation store missing".
 */
mock.module("next/cache", () => ({
  revalidateTag: mock((tag: string) => {
    attemptedTags.push(tag);
    throw new Error("Invariant: static generation store missing");
  }),
}));

const { invalidateLeadCache, invalidateHealthPlansCache } = await import("./invalidation");

beforeEach(() => {
  attemptedTags.length = 0;
});

describe("revalidateDefinedTags fora de um work store", () => {
  it("nao propaga o erro do revalidateTag", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => invalidateHealthPlansCache()).not.toThrow();

    warn.mockRestore();
  });

  it("nao aborta as tags seguintes quando a primeira falha", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);

    invalidateLeadCache({ leadId: "lead-1", teamId: "team-1" });

    // Todas as tags do conjunto precisam ter sido tentadas, e nao apenas a primeira.
    expect(attemptedTags).toEqual([
      "lead:lead-1",
      "lead-details:lead-1",
      "team-leads:team-1",
      "team-calendar:team-1",
      "team-dashboard:team-1",
      "team-performance:team-1",
    ]);

    warn.mockRestore();
  });

  it("registra um aviso por tag ignorada", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);

    invalidateHealthPlansCache();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("health-plans");

    warn.mockRestore();
  });
});
