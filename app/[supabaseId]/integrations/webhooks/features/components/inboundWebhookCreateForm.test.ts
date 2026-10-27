import { describe, expect, it } from "bun:test";
import type { TeamMemberOption } from "../services/ITeamWebhooksService";
import {
  buildInboundCreatePayload,
  INITIAL_INBOUND_CREATE_FORM,
  listClosersWithoutGoogle,
  listSdrs,
  moveAssignee,
  toggleAssignee,
  validateInboundCreateForm,
  type InboundCreateFormState,
} from "./inboundWebhookCreateForm";

const member = (overrides: Partial<TeamMemberOption>): TeamMemberOption => ({
  profileId: "p",
  name: "Fulano",
  functions: [],
  googleCalendarConnected: false,
  ...overrides,
});

const members: TeamMemberOption[] = [
  member({ profileId: "sdr-1", name: "Sara", functions: ["SDR"] }),
  member({ profileId: "sdr-2", name: "Davi", functions: ["SDR"] }),
  member({ profileId: "closer-1", name: "Ana Lima", functions: ["CLOSER"], googleCalendarConnected: true }),
  member({ profileId: "closer-2", name: "Bia Souza", functions: ["CLOSER"], googleCalendarConnected: false }),
];

const v2 = (patch: Partial<InboundCreateFormState> = {}): InboundCreateFormState => ({
  ...INITIAL_INBOUND_CREATE_FORM,
  assigneeProfileIds: ["sdr-1"],
  defaultMeetingLink: "https://meet.google.com/abc-defg-hij",
  ...patch,
});

describe("formulário de webhook de entrada — v2 é o padrão (B-E1)", () => {
  it("webhook novo nasce v2, com token automático, validade de 6 meses e agenda habilitada", () => {
    expect(INITIAL_INBOUND_CREATE_FORM.version).toBe(2);
    expect(INITIAL_INBOUND_CREATE_FORM.base).toMatchObject({ tokenMode: "auto", expiryMode: "months_6" });
    expect(INITIAL_INBOUND_CREATE_FORM.scopeSchedule).toBe(true);
  });

  it("separa SDRs e closers sem Google", () => {
    expect(listSdrs(members).map((m) => m.name)).toEqual(["Sara", "Davi"]);
    expect(listClosersWithoutGoogle(members).map((m) => m.name)).toEqual(["Bia Souza"]);
  });
});

describe("ordem do rodízio", () => {
  it("a ordem de escolha é a ordem do rodízio, e desmarcar remove", () => {
    let order: string[] = [];
    order = toggleAssignee(order, "sdr-2");
    order = toggleAssignee(order, "sdr-1");
    expect(order).toEqual(["sdr-2", "sdr-1"]);
    expect(toggleAssignee(order, "sdr-2")).toEqual(["sdr-1"]);
  });

  it("mover para cima/baixo troca posições e respeita as bordas", () => {
    expect(moveAssignee(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveAssignee(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveAssignee(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveAssignee(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(moveAssignee(["a"], "x", 1)).toEqual(["a"]);
  });
});

describe("validação v2 (espelha o servidor)", () => {
  it("exige ao menos um SDR", () => {
    expect(validateInboundCreateForm(v2({ assigneeProfileIds: [] }), members)).toEqual({
      ok: false,
      reason: "Escolha ao menos um SDR para receber os leads.",
    });
  });

  it("T-11.22b: com closer sem Google, o link de Meet é obrigatório e nomeia o closer", () => {
    const result = validateInboundCreateForm(v2({ defaultMeetingLink: "" }), members);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain("Bia Souza");
  });

  it("com todos os closers conectados o link é opcional", () => {
    const connected = members.map((m) => ({ ...m, googleCalendarConnected: true }));
    expect(validateInboundCreateForm(v2({ defaultMeetingLink: "" }), connected)).toEqual({ ok: true });
  });

  it("o link precisa ser https", () => {
    for (const link of ["http://meet.google.com/x", "meet.google.com/x", "javascript:void(0)"]) {
      expect(validateInboundCreateForm(v2({ defaultMeetingLink: link }), members).ok).toBe(false);
    }
  });

  it("recusa validade indeterminada na v2, mas v1 continua aceitando", () => {
    const indeterminate = { ...INITIAL_INBOUND_CREATE_FORM.base, expiryMode: "indeterminate" as const };
    expect(validateInboundCreateForm(v2({ base: indeterminate }), members).ok).toBe(false);
    expect(validateInboundCreateForm({ ...INITIAL_INBOUND_CREATE_FORM, version: 1, base: indeterminate }, members)).toEqual({ ok: true });
  });

  it("v1 mantém a regra do token manual de 8 caracteres", () => {
    const manual = { ...INITIAL_INBOUND_CREATE_FORM.base, tokenMode: "manual" as const, manualToken: "curto" };
    expect(validateInboundCreateForm({ ...INITIAL_INBOUND_CREATE_FORM, version: 1, base: manual }, members).ok).toBe(false);
  });
});

describe("payload enviado à API", () => {
  it("v2: versão, escopos, SDRs em ordem e link; token sempre automático", () => {
    const payload = buildInboundCreatePayload(
      v2({ assigneeProfileIds: ["sdr-2", "sdr-1"], base: { ...INITIAL_INBOUND_CREATE_FORM.base, tokenMode: "manual", manualToken: "xxxxxxxxxx" } }),
    );
    expect(payload).toMatchObject({
      direction: "inbound",
      contractVersion: 2,
      tokenMode: "auto",
      scopes: ["leads_create", "leads_schedule"],
      defaultAssigneeProfileIds: ["sdr-2", "sdr-1"],
      defaultMeetingLink: "https://meet.google.com/abc-defg-hij",
    });
    expect(payload.manualToken).toBeUndefined();
  });

  it("sem agenda habilitada, só o escopo leads_create", () => {
    expect(buildInboundCreatePayload(v2({ scopeSchedule: false })).scopes).toEqual(["leads_create"]);
  });

  it("link vazio vira null", () => {
    expect(buildInboundCreatePayload(v2({ defaultMeetingLink: "  " })).defaultMeetingLink).toBeNull();
  });

  it("v1 não envia nenhum campo da v2 (contrato congelado)", () => {
    const payload = buildInboundCreatePayload({ ...INITIAL_INBOUND_CREATE_FORM, version: 1 });
    for (const key of ["contractVersion", "scopes", "defaultAssigneeProfileIds", "defaultMeetingLink"]) {
      expect(payload).not.toHaveProperty(key);
    }
  });
});
