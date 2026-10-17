import { describe, expect, it } from "bun:test";
import { normalizeExtraGuests, validateFutureMeetingDate } from "./meetingInputValidation";

describe("meeting input validation", () => {
  it("normaliza e deduplica convidados", () => {
    expect(normalizeExtraGuests([" Guest@Example.com ", "guest@example.com"])).toEqual({
      valid: true,
      guests: ["guest@example.com"],
    });
  });

  it("rejeita quantidade e emails fora dos limites", () => {
    expect(normalizeExtraGuests(Array.from({ length: 11 }, (_, index) => `guest${index}@example.com`)).valid).toBe(false);
    expect(normalizeExtraGuests(["not-an-email"]).valid).toBe(false);
  });

  it("rejeita datas passadas e além do horizonte futuro", () => {
    const now = new Date("2026-10-16T12:00:00.000Z");
    expect(validateFutureMeetingDate(new Date("2026-10-16T11:59:00.000Z"), now)).toBeTruthy();
    expect(validateFutureMeetingDate(new Date("2027-10-17T12:00:00.000Z"), now)).toBeTruthy();
    expect(validateFutureMeetingDate(new Date("2026-10-20T12:00:00.000Z"), now)).toBeNull();
  });
});
