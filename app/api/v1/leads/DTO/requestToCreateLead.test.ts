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

function meetingLinkIssue(error: unknown) {
  const zodError = error as { issues?: Array<{ path: unknown[] }> };
  return zodError.issues?.find((issue) => issue.path[0] === "meetingLink");
}

// SPEC 13 (Agenda na Criação de Lead), A-E1d — T-13.1d: o link da reunião só
// aceita https (DA8), usando a mesma validação de lib/validations/meetingLink.ts.
// Este DTO é o que de fato persiste o link (via LeadUseCase) — sem a
// exceção de legado que `leadFormSchema` precisou (achado R13d-1): aqui
// `http:` é sempre recusado, gravado ou não.
describe("CreateLeadRequestSchema — meetingLink só https (SPEC 13, A-E1d, T-13.1d)", () => {
  it("aceita link https", () => {
    const result = CreateLeadRequestSchema.parse({
      ...MINIMAL_INPUT,
      meetingLink: "https://meet.google.com/abc-defg-hij",
    });
    expect(result.meetingLink).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("recusa link http (controle negativo: z.string().url() aceitaria)", () => {
    try {
      CreateLeadRequestSchema.parse({
        ...MINIMAL_INPUT,
        meetingLink: "http://meet.google.com/abc-defg-hij",
      });
      throw new Error("deveria ter lançado");
    } catch (error) {
      expect(meetingLinkIssue(error)).toBeDefined();
    }
  });

  it("recusa esquema javascript:", () => {
    try {
      CreateLeadRequestSchema.parse({
        ...MINIMAL_INPUT,
        meetingLink: "javascript:void(0)",
      });
      throw new Error("deveria ter lançado");
    } catch (error) {
      expect(meetingLinkIssue(error)).toBeDefined();
    }
  });
});
