import { describe, expect, it } from "bun:test";
import { leadFormSchema } from "./validationForms";

const MINIMAL_INPUT = {
  name: "Lead Teste",
  phone: "11999999999",
  responsible: "Closer Teste",
};

function meetingLinkIssue(error: unknown) {
  const zodError = error as { issues?: Array<{ path: unknown[] }> };
  return zodError.issues?.find((issue) => issue.path[0] === "meetingLink");
}

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E1d — T-13.1d: o link da reunião só
 * aceita https (DA8), usando a mesma validação de lib/validations/meetingLink.ts.
 *
 * Achado da revisão xhigh (R13d-1): `leadFormSchema.meetingLink` só existe
 * para EXIBIR o link já gravado no CRM (`LeadDialog` carrega
 * `currentLead.meetingLink` em `defaultValues`) — `transformToCreateRequest`/
 * `transformToUpdateRequest` sempre mandam `meetingLink: undefined`, então o
 * valor nunca é reenviado ao backend por este formulário. Recusar `http:`
 * aqui sem exceção quebrava a edição de QUALQUER campo (nome, telefone,
 * notas) de um lead com reunião já gravada com link `http:` legado (o
 * próprio carry-over que a A-E1c criou). Por isso este campo usa
 * `allowLegacyHttp: true`: aceita o `http:` que já veio persistido, mas
 * continua recusando esquemas perigosos (`javascript:`, etc.).
 *
 * Antes desta correção (achado da revisão): `http:` era recusado aqui como
 * nos outros dois arquivos — e essa era a mudança que quebrava a edição de
 * leads legados. Depois: só este campo aceita `http:` (nunca escrito de
 * volta); `requestToCreateLead.ts`/`requestToUpdateLead.ts` (os DTOs que
 * realmente persistem o link) continuam recusando `http:` sem exceção.
 */
describe("leadFormSchema — meetingLink (SPEC 13, A-E1d, T-13.1d)", () => {
  it("aceita link https", () => {
    const result = leadFormSchema.parse({
      ...MINIMAL_INPUT,
      meetingLink: "https://meet.google.com/abc-defg-hij",
    });
    expect(result.meetingLink).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("aceita link http legado (campo só de exibição, nunca reenviado ao backend — R13d-1)", () => {
    const result = leadFormSchema.parse({
      ...MINIMAL_INPUT,
      meetingLink: "http://meet.google.com/abc-defg-hij",
    });
    expect(result.meetingLink).toBe("http://meet.google.com/abc-defg-hij");
  });

  it("recusa esquema javascript: mesmo com a exceção de legado (controle negativo: z.string().url() aceitaria)", () => {
    try {
      leadFormSchema.parse({
        ...MINIMAL_INPUT,
        meetingLink: "javascript:void(0)",
      });
      throw new Error("deveria ter lançado");
    } catch (error) {
      expect(meetingLinkIssue(error)).toBeDefined();
    }
  });

  it("aceita string vazia (campo opcional no formulário)", () => {
    const result = leadFormSchema.parse({ ...MINIMAL_INPUT, meetingLink: "" });
    expect(result.meetingLink).toBe("");
  });
});
