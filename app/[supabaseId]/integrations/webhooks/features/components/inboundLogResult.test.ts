import { describe, expect, it } from "bun:test";
import { INBOUND_RESULT_CODES } from "@/lib/webhooks/inbound/v2/resultCodes";
import { RESULT_CODE_LABELS, readInboundLogOutcome, shortEventId } from "./inboundLogResult";

describe("readInboundLogOutcome", () => {
  it("lê o desfecho de um evento processado", () => {
    const outcome = readInboundLogOutcome({
      event_id: "11111111-2222-3333-4444-555555555555",
      result_code: "processed",
      lead_id: "lead-1",
      lead_code: "AB12CD",
      idempotency_key_reused: false,
    });

    expect(outcome).toMatchObject({ resultCode: "processed", leadId: "lead-1", leadCode: "AB12CD", replay: false, needsReschedule: false });
    expect(outcome?.description.length).toBeGreaterThan(10);
  });

  it("marca conflito de horário como remarcação urgente e reenvio como replay", () => {
    const outcome = readInboundLogOutcome({ event_id: "e", result_code: "schedule_conflict_flagged", idempotency_key_reused: true });

    expect(outcome).toMatchObject({ needsReschedule: true, replay: true, leadId: null, leadCode: null });
  });

  it("ignora respostas de saída, de teste e códigos desconhecidos", () => {
    expect(readInboundLogOutcome(null)).toBeNull();
    expect(readInboundLogOutcome("texto")).toBeNull();
    expect(readInboundLogOutcome([])).toBeNull();
    expect(readInboundLogOutcome({ ok: true })).toBeNull();
    expect(readInboundLogOutcome({ result_code: "codigo_inventado" })).toBeNull();
  });

  it("todo código de resultado tem rótulo curto", () => {
    expect(Object.keys(RESULT_CODE_LABELS).sort()).toEqual(Object.values(INBOUND_RESULT_CODES).sort());
  });

  it("abrevia o event_id", () => {
    expect(shortEventId("11111111-2222-3333-4444-555555555555")).toBe("11111111");
    expect(shortEventId(null)).toBeNull();
  });
});
