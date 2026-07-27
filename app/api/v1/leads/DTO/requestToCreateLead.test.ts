import { describe, expect, it } from "bun:test";
import { CreateLeadRequestSchema } from "./requestToCreateLead";

const MINIMAL_INPUT = {
  name: "Lead Teste",
};

describe("CreateLeadRequestSchema — originChannel/originMetadata (D2)", () => {
  it("originChannel fica undefined quando não informado (sem default no Zod)", () => {
    const result = CreateLeadRequestSchema.parse(MINIMAL_INPUT);
    expect(result.originChannel).toBeUndefined();
    expect(result.originMetadata).toBeUndefined();
  });

  it("aceita um originChannel válido e originMetadata arbitrário", () => {
    const result = CreateLeadRequestSchema.parse({
      ...MINIMAL_INPUT,
      originChannel: "studio_webhook",
      originMetadata: { source: "webhook_generico", submittedAt: "2026-07-24T00:00:00.000Z" },
    });
    expect(result.originChannel).toBe("studio_webhook");
    expect(result.originMetadata).toEqual({
      source: "webhook_generico",
      submittedAt: "2026-07-24T00:00:00.000Z",
    });
  });

  it("rejeita um originChannel fora do enum LeadOriginChannel", () => {
    expect(() =>
      CreateLeadRequestSchema.parse({ ...MINIMAL_INPUT, originChannel: "not_a_real_channel" })
    ).toThrow();
  });
});
