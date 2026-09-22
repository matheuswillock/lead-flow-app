import { describe, expect, it } from "bun:test";
import { resolveBestEffortCalendarFailure } from "./resolveBestEffortCalendarFailure";

describe("resolveBestEffortCalendarFailure", () => {
  it("reagendamento com evento vinculado sai marcado como dessincronizado, preservando o id do evento", () => {
    const failure = resolveBestEffortCalendarFailure({
      existingGoogleEventId: "evt-123",
      errorMessage: "invalid_grant",
    });

    expect(failure.isStaleLinkage).toBe(true);
    expect(failure.payload).toEqual({ status: "failed", error: "invalid_grant", staleEventId: "evt-123" });
    expect(failure.lastError).toContain("continua com a data anterior");
    expect(failure.lastError).toContain("invalid_grant");
    expect(failure.warning).toContain("continua com a data anterior");
  });

  it("primeiro agendamento sem evento prévio registra a falha sem apontar vínculo obsoleto", () => {
    const failure = resolveBestEffortCalendarFailure({
      existingGoogleEventId: null,
      errorMessage: "quota exceeded",
    });

    expect(failure.isStaleLinkage).toBe(false);
    expect(failure.payload).toEqual({ status: "failed", error: "quota exceeded", staleEventId: null });
    expect(failure.lastError).toContain("não foi criado");
    expect(failure.warning).not.toContain("data anterior");
  });

  it("id de evento em branco não conta como vínculo", () => {
    const failure = resolveBestEffortCalendarFailure({
      existingGoogleEventId: "   ",
      errorMessage: "timeout",
    });

    expect(failure.isStaleLinkage).toBe(false);
    expect(failure.payload.staleEventId).toBeNull();
  });
});
