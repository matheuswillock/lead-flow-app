import { describe, expect, it } from "bun:test";
import { UpdateLeadRequestSchema } from "./requestToUpdateLead";

function meetingLinkIssue(error: unknown) {
  const zodError = error as { issues?: Array<{ path: unknown[] }> };
  return zodError.issues?.find((issue) => issue.path[0] === "meetingLink");
}

// SPEC 13 (Agenda na Criação de Lead), A-E1d — T-13.1d: o link da reunião só
// aceita https (DA8), usando a mesma validação de lib/validations/meetingLink.ts.
//
// Dívida registrada na revisão (R13d-2, não bloqueante): um cliente de API
// que reenvie sem alteração um link `http:` já persistido (carry-over
// legado da A-E1c) recebe 400 aqui, porque este DTO não tem acesso ao valor
// já gravado no banco para aplicar `allowLegacyHttp`. A UI do produto não é
// afetada — `LeadDialog.transformToUpdateRequest` sempre manda
// `meetingLink: undefined` (nunca reenvia o valor exibido). Só um cliente de
// API direto (Postman, integração) que releia e regrave o mesmo valor
// esbarraria nisso. Resolver exigiria o use case comparar contra o valor
// persistido antes de validar — fora do escopo deste PR, pequeno e isolado.
describe("UpdateLeadRequestSchema — meetingLink só https (SPEC 13, A-E1d, T-13.1d)", () => {
  it("aceita link https", () => {
    const result = UpdateLeadRequestSchema.parse({
      meetingLink: "https://meet.google.com/abc-defg-hij",
    });
    expect(result.meetingLink).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("recusa link http (controle negativo: z.string().url() aceitaria)", () => {
    try {
      UpdateLeadRequestSchema.parse({
        meetingLink: "http://meet.google.com/abc-defg-hij",
      });
      throw new Error("deveria ter lançado");
    } catch (error) {
      expect(meetingLinkIssue(error)).toBeDefined();
    }
  });

  it("recusa esquema javascript:", () => {
    try {
      UpdateLeadRequestSchema.parse({
        meetingLink: "javascript:void(0)",
      });
      throw new Error("deveria ter lançado");
    } catch (error) {
      expect(meetingLinkIssue(error)).toBeDefined();
    }
  });

  it("aceita ausência de meetingLink (campo opcional)", () => {
    expect(() => UpdateLeadRequestSchema.parse({})).not.toThrow();
  });
});
