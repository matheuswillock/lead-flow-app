import { describe, expect, it } from "bun:test";
import { parseMeetingDatetimeInput } from "./parse-meeting-datetime";

describe("parseMeetingDatetimeInput", () => {
  it("parseia data/hora sem título", () => {
    const parsed = parseMeetingDatetimeInput("15/07/2026 14:30");
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBeNull();
    expect(parsed!.isoDate).toBe(new Date("2026-07-15T14:30:00-03:00").toISOString());
  });

  it("parseia data/hora com título", () => {
    const parsed = parseMeetingDatetimeInput("15/07/2026 14:30 | Visita técnica");
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe("Visita técnica");
  });

  it("rejeita formato inválido", () => {
    expect(parseMeetingDatetimeInput("amanhã 14h")).toBeNull();
    expect(parseMeetingDatetimeInput("")).toBeNull();
    expect(parseMeetingDatetimeInput("32/13/2026 25:99")).toBeNull();
  });
});
