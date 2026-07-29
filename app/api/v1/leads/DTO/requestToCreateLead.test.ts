import { describe, expect, it } from "bun:test";
import { CreateLeadRequestSchema } from "./requestToCreateLead";

const MINIMAL_INPUT = {
  name: "Lead Teste",
};

describe("CreateLeadRequestSchema — provenance isolation (PR 536)", () => {
  it("não inclui originChannel/originMetadata no resultado do parse público", () => {
    const result = CreateLeadRequestSchema.parse(MINIMAL_INPUT);
    expect(result).not.toHaveProperty("originChannel");
    expect(result).not.toHaveProperty("originMetadata");
  });

  it("descarta provenance enviada pelo client (não confia no DTO público)", () => {
    const result = CreateLeadRequestSchema.parse({
      ...MINIMAL_INPUT,
      originChannel: "studio_webhook",
      originMetadata: { source: "spoofed" },
    });
    expect(result).not.toHaveProperty("originChannel");
    expect(result).not.toHaveProperty("originMetadata");
  });

  it("não valida originChannel no schema público (campo é stripado, não rejeitado)", () => {
    expect(() =>
      CreateLeadRequestSchema.parse({ ...MINIMAL_INPUT, originChannel: "not_a_real_channel" })
    ).not.toThrow();
  });
});
