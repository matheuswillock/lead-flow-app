import type { CreateInboundWebhookPayload, TeamMemberOption } from "../services/ITeamWebhooksService";
import type { WebhookInboundFormValues } from "./WebhookInboundConfigFields";

/**
 * Estado e regras do formulário de criação de webhook de entrada (SPEC 11, B-E1). Lógica pura, sem
 * React: monta o payload da API e antecipa no cliente as mesmas recusas que o servidor faz, para o
 * manager corrigir antes de enviar. O servidor continua sendo a fonte da verdade.
 */
export type InboundCreateFormState = {
  base: WebhookInboundFormValues;
  /** v2 é a versão recomendada para webhook novo; v1 fica para integrações já existentes. */
  version: 1 | 2;
  scopeSchedule: boolean;
  /** SDRs padrão em rodízio, na ordem de escolha. */
  assigneeProfileIds: string[];
  defaultMeetingLink: string;
};

export const INITIAL_INBOUND_CREATE_FORM: InboundCreateFormState = {
  base: { name: "Webhook Genérico de Leads", tokenMode: "auto", manualToken: "", expiryMode: "months_6" },
  version: 2,
  scopeSchedule: true,
  assigneeProfileIds: [],
  defaultMeetingLink: "",
};

export function listSdrs(members: TeamMemberOption[]): TeamMemberOption[] {
  return members.filter((member) => member.functions.includes("SDR"));
}

/** Closers sem Google conectado: pedem o link de Meet padrão (DA10). */
export function listClosersWithoutGoogle(members: TeamMemberOption[]): TeamMemberOption[] {
  return members.filter((member) => member.functions.includes("CLOSER") && !member.googleCalendarConnected);
}

export function toggleAssignee(current: string[], profileId: string): string[] {
  return current.includes(profileId) ? current.filter((id) => id !== profileId) : [...current, profileId];
}

export function moveAssignee(current: string[], profileId: string, direction: -1 | 1): string[] {
  const index = current.indexOf(profileId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= current.length) return current;
  const next = [...current];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export type InboundCreateValidation = { ok: true } | { ok: false; reason: string };

export function validateInboundCreateForm(
  state: InboundCreateFormState,
  members: TeamMemberOption[],
): InboundCreateValidation {
  if (state.base.name.trim().length === 0) return { ok: false, reason: "Informe o nome do webhook." };

  if (state.version === 1) {
    if (state.base.tokenMode === "manual" && state.base.manualToken.trim().length < 8) {
      return { ok: false, reason: "O token manual precisa de ao menos 8 caracteres." };
    }
    return { ok: true };
  }

  if (state.assigneeProfileIds.length === 0) {
    return { ok: false, reason: "Escolha ao menos um SDR para receber os leads." };
  }
  if (state.base.expiryMode === "indeterminate") {
    return { ok: false, reason: "Na versão 2 o token precisa de validade." };
  }

  const link = state.defaultMeetingLink.trim();
  if (link && !/^https:\/\/\S+$/i.test(link)) {
    return { ok: false, reason: "O link de Meet padrão precisa começar com https://." };
  }
  const missingGoogle = listClosersWithoutGoogle(members);
  if (!link && missingGoogle.length > 0) {
    return {
      ok: false,
      reason: `Informe o link de Meet padrão: ${missingGoogle.map((closer) => closer.name).join(", ")} não tem Google conectado.`,
    };
  }
  return { ok: true };
}

export function buildInboundCreatePayload(state: InboundCreateFormState): CreateInboundWebhookPayload {
  const base = {
    direction: "inbound" as const,
    name: state.base.name.trim(),
    tokenMode: state.base.tokenMode,
    manualToken: state.base.tokenMode === "manual" ? state.base.manualToken.trim() : undefined,
    expiryMode: state.base.expiryMode,
  };

  if (state.version === 1) return base;

  const link = state.defaultMeetingLink.trim();
  return {
    ...base,
    // v2: token só gerado (D22), com validade (D20).
    tokenMode: "auto",
    manualToken: undefined,
    contractVersion: 2,
    scopes: state.scopeSchedule ? ["leads_create", "leads_schedule"] : ["leads_create"],
    defaultAssigneeProfileIds: state.assigneeProfileIds,
    defaultMeetingLink: link || null,
  };
}
