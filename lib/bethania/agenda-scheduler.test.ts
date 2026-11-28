import { describe, expect, it } from "bun:test";
import { getLocalAgendaSlot } from "./agenda-scheduler";

describe("getLocalAgendaSlot", () => {
  it("returns a stable local date and slot only at the configured wall-clock minute", () => {
    expect(getLocalAgendaSlot(new Date("2026-11-23T10:00:00.000Z"), "America/Sao_Paulo", 7)).toEqual({
      localDate: "2026-11-23",
      isDue: true,
    });
    expect(getLocalAgendaSlot(new Date("2026-11-23T10:01:00.000Z"), "America/Sao_Paulo", 7)).toEqual({
      localDate: "2026-11-23",
      isDue: false,
    });
  });

  it("uses the recipient timezone across a daylight-saving offset change", () => {
    expect(getLocalAgendaSlot(new Date("2026-11-01T11:00:00.000Z"), "America/New_York", 7)).toEqual({
      localDate: "2026-11-01",
      isDue: false,
    });
    expect(getLocalAgendaSlot(new Date("2026-11-01T12:00:00.000Z"), "America/New_York", 7)).toEqual({
      localDate: "2026-11-01",
      isDue: true,
    });
  });

  it("falls back to Sao Paulo for invalid profile timezones", () => {
    expect(getLocalAgendaSlot(new Date("2026-11-23T10:00:00.000Z"), "Invalid/Zone", 7)).toEqual({
      localDate: "2026-11-23",
      isDue: true,
    });
  });
});