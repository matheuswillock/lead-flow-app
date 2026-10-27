import { RESULT_CODE_DESCRIPTIONS } from "@/lib/webhooks/inbound/v2/contractDocs";
import { INBOUND_RESULT_CODES, type InboundResultCode } from "@/lib/webhooks/inbound/v2/resultCodes";

/** Rótulo curto para a linha do log. Lista exaustiva: código novo sem rótulo não compila. */
export const RESULT_CODE_LABELS: Record<InboundResultCode, string> = {
  processed: "Lead criado",
  processed_new_lead_for_existing_contact: "Novo lead para contato existente",
  lead_merged: "Dados mesclados no lead existente",
  duplicate_scheduled_lead: "Contato já agendado",
  invalid_payload: "Dados inválidos",
  missing_scope: "Sem permissão para o evento",
  schedule_conflict_flagged: "Horário ocupado: remarcar",
  closer_not_in_team: "Closer fora do time: remarcar",
  schedule_in_past: "Horário no passado: remarcar",
  schedule_out_of_range: "Horário fora da janela: remarcar",
  online_without_email: "Online sem e-mail: remarcar",
  closer_without_google: "Closer sem Google: remarcar",
  schedule_failed: "Falha ao agendar: remarcar",
  duplicate_conflict: "Conflito de duplicidade",
  no_valid_assignee: "Sem SDR válido",
  webhook_inactive: "Webhook desativado",
  account_restricted: "Conta pausada",
  team_not_found: "Time não encontrado",
};

export type InboundLogOutcome = {
  eventId: string | null;
  resultCode: InboundResultCode;
  /** Rótulo curto em português para a linha do log. */
  label: string;
  /** Descrição curta em português, a mesma do contrato publicado. */
  description: string;
  leadId: string | null;
  leadCode: string | null;
  replay: boolean;
  /** O lead entrou sem reunião e com o selo "Remarcar urgente". */
  needsReschedule: boolean;
};

const RESCHEDULE_CODES: ReadonlySet<string> = new Set([
  INBOUND_RESULT_CODES.scheduleConflictFlagged,
  INBOUND_RESULT_CODES.closerNotInTeam,
  INBOUND_RESULT_CODES.scheduleInPast,
  INBOUND_RESULT_CODES.scheduleOutOfRange,
  INBOUND_RESULT_CODES.onlineWithoutEmail,
  INBOUND_RESULT_CODES.closerWithoutGoogle,
  INBOUND_RESULT_CODES.scheduleFailed,
]);

function isKnownResultCode(value: unknown): value is InboundResultCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(RESULT_CODE_DESCRIPTIONS, value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Lê o desfecho que `ProcessInboundWebhookEventUseCase` grava na resposta do log do webhook de entrada v2.
 * Devolve `null` para logs de saída, testes de envio e qualquer resposta sem um `result_code` conhecido.
 */
export function readInboundLogOutcome(responsePayload: unknown): InboundLogOutcome | null {
  if (!responsePayload || typeof responsePayload !== "object" || Array.isArray(responsePayload)) return null;
  const payload = responsePayload as Record<string, unknown>;
  if (!isKnownResultCode(payload.result_code)) return null;
  const resultCode = payload.result_code;
  return {
    eventId: text(payload.event_id),
    resultCode,
    label: RESULT_CODE_LABELS[resultCode],
    description: RESULT_CODE_DESCRIPTIONS[resultCode],
    leadId: text(payload.lead_id),
    leadCode: text(payload.lead_code),
    replay: payload.idempotency_key_reused === true,
    needsReschedule: RESCHEDULE_CODES.has(resultCode),
  };
}

/** Primeiros 8 caracteres do `event_id`, o suficiente para achar o evento sem ocupar a linha. */
export function shortEventId(eventId: string | null): string | null {
  return eventId ? eventId.slice(0, 8) : null;
}
