/**
 * Códigos estáveis do desfecho de um evento do webhook v2 (SPEC 11, DA8). São o contrato com quem
 * acompanha os logs do webhook no app (único canal de retorno: o agente externo não consulta resultado).
 * Nunca renomear um código existente.
 */
export const INBOUND_RESULT_CODES = {
  processed: "processed",
  processedNewLeadForExistingContact: "processed_new_lead_for_existing_contact",
  leadMerged: "lead_merged",
  duplicateScheduledLead: "duplicate_scheduled_lead",
  invalidPayload: "invalid_payload",
  missingScope: "missing_scope",
  scheduleConflictFlagged: "schedule_conflict_flagged",
  closerNotInTeam: "closer_not_in_team",
  scheduleInPast: "schedule_in_past",
  scheduleOutOfRange: "schedule_out_of_range",
  onlineWithoutEmail: "online_without_email",
  closerWithoutGoogle: "closer_without_google",
  scheduleFailed: "schedule_failed",
  duplicateConflict: "duplicate_conflict",
  noValidAssignee: "no_valid_assignee",
  webhookInactive: "webhook_inactive",
  accountRestricted: "account_restricted",
  teamNotFound: "team_not_found",
} as const;

export type InboundResultCode = (typeof INBOUND_RESULT_CODES)[keyof typeof INBOUND_RESULT_CODES];

/** Códigos que contam como evento tratado com sucesso no log do webhook. */
const REJECTED_CODES: ReadonlySet<string> = new Set([
  INBOUND_RESULT_CODES.invalidPayload,
  INBOUND_RESULT_CODES.webhookInactive,
  INBOUND_RESULT_CODES.accountRestricted,
  INBOUND_RESULT_CODES.teamNotFound,
]);

const FAILURE_CODES: ReadonlySet<string> = new Set([INBOUND_RESULT_CODES.duplicateConflict]);

export function resolveInboundLogResult(code: string): "success" | "failure" | "rejected" {
  if (REJECTED_CODES.has(code)) return "rejected";
  if (FAILURE_CODES.has(code)) return "failure";
  return "success";
}
