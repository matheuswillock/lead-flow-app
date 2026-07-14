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

  it("parseia link da reunião após o título", () => {
    const parsed = parseMeetingDatetimeInput(
      "15/07/2026 14:30 | Visita técnica | https://meet.google.com/abc-defg-hij"
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe("Visita técnica");
    expect(parsed!.meetingLink).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("parseia link sem título (em qualquer posição)", () => {
    const parsed = parseMeetingDatetimeInput("15/07/2026 14:30 | https://meet.google.com/abc");
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBeNull();
    expect(parsed!.meetingLink).toBe("https://meet.google.com/abc");

    const inverted = parseMeetingDatetimeInput(
      "15/07/2026 14:30 | https://meet.google.com/abc | Visita técnica"
    );
    expect(inverted!.title).toBe("Visita técnica");
    expect(inverted!.meetingLink).toBe("https://meet.google.com/abc");
  });

  it("rejeita formato inválido", () => {
    expect(parseMeetingDatetimeInput("amanhã 14h")).toBeNull();
    expect(parseMeetingDatetimeInput("")).toBeNull();
    expect(parseMeetingDatetimeInput("32/13/2026 25:99")).toBeNull();
  });

  it("rejeita datas inexistentes no calendário (sem normalizar)", () => {
    expect(parseMeetingDatetimeInput("31/02/2026 14:30")).toBeNull();
    expect(parseMeetingDatetimeInput("31/04/2026 10:00")).toBeNull();
    expect(parseMeetingDatetimeInput("29/02/2027 10:00")).toBeNull();
  });

  it("aceita 29/02 em ano bissexto", () => {
    const parsed = parseMeetingDatetimeInput("29/02/2028 10:00");
    expect(parsed).not.toBeNull();
    expect(parsed!.isoDate).toBe(new Date("2028-02-29T10:00:00-03:00").toISOString());
  });
});
