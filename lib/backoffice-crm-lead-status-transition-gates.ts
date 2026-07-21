import type {
  BackofficeLeadStatus,
  BackofficeLeadTransitionGateType,
} from "@prisma/client";

export type CrmLeadStatusTransitionGateBlockerType =
  | "sales_info"
  | "meeting_heald"
  | "schedule_required"
  | "finalize_contract"
  | "future_sale_trigger"
  | "loss_reason_trigger"
  | "validation_error"
  | "email_required"
  | "closer_required";

export type CrmLeadStatusTransitionGateRow = {
  id: string;
  slug: string;
  name: string;
  gateType: BackofficeLeadTransitionGateType;
  sourceStatus: BackofficeLeadStatus | null;
  targetStatus: BackofficeLeadStatus | null;
  config: unknown;
  blockerType: string;
  errorMessage: string | null;
  isEnabled: boolean;
  sortOrder: number;
};

export type CrmAllowedTargetStatusesConfig = {
  allowedTargetStatuses: BackofficeLeadStatus[];
};

export type CrmRequireCloserConfig = {
  targetStatuses: BackofficeLeadStatus[];
};

export const CRM_GATE_TYPE_LABELS: Record<BackofficeLeadTransitionGateType, string> = {
  allowed_target_statuses: "Destinos permitidos (whitelist)",
  block_targets_when_field_equals: "Bloquear destinos quando campo igual",
  require_meeting_heald_on_exit: "Exigir reunião realizada ao sair",
  require_no_show_preconditions: "Pré-condições de no-show",
  require_sales_info: "Exigir dados de venda",
  require_finalize_contract: "Exigir contrato finalizado",
  require_schedule_artifacts: "Exigir agendamento válido",
  require_trigger_future_sale: "Exigir data de venda futura",
  require_trigger_loss_reason: "Exigir motivo de perda",
  require_email_for_online_schedule: "Exigir e-mail para agendamento online",
  require_finalize_contract_flow: "Usar fluxo de fechamento de contrato",
  require_closer: "Exigir closer do time",
};

/** @deprecated Use CRM_GATE_TYPE_LABELS — alias for admin UI parity with product gates. */
export const GATE_TYPE_LABELS = CRM_GATE_TYPE_LABELS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStatusArray(value: unknown): BackofficeLeadStatus[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is BackofficeLeadStatus => typeof item === "string");
}

export function parseCrmAllowedTargetStatusesConfig(
  config: unknown
): CrmAllowedTargetStatusesConfig {
  if (!isRecord(config)) return { allowedTargetStatuses: [] };
  return {
    allowedTargetStatuses: readStatusArray(config.allowedTargetStatuses),
  };
}

export function parseCrmRequireCloserConfig(config: unknown): CrmRequireCloserConfig {
  if (!isRecord(config)) return { targetStatuses: ["scheduled"] };
  const targetStatuses = readStatusArray(config.targetStatuses);
  return {
    targetStatuses: targetStatuses.length > 0 ? targetStatuses : ["scheduled"],
  };
}

export function crmGateMatchesTransition(
  gate: Pick<CrmLeadStatusTransitionGateRow, "sourceStatus" | "targetStatus">,
  sourceStatus: BackofficeLeadStatus,
  targetStatus: BackofficeLeadStatus
): boolean {
  if (gate.sourceStatus && gate.sourceStatus !== sourceStatus) return false;
  if (gate.targetStatus && gate.targetStatus !== targetStatus) return false;
  return true;
}

export function isCrmTransitionAllowedByGates(
  gates: CrmLeadStatusTransitionGateRow[],
  sourceStatus: BackofficeLeadStatus,
  targetStatus: BackofficeLeadStatus
): boolean {
  if (sourceStatus === targetStatus) return true;
  const whitelistGate = gates.find(
    (item) =>
      item.isEnabled &&
      item.gateType === "allowed_target_statuses" &&
      crmGateMatchesTransition(item, sourceStatus, targetStatus)
  );
  if (!whitelistGate) return true;
  const { allowedTargetStatuses } = parseCrmAllowedTargetStatusesConfig(whitelistGate.config);
  return allowedTargetStatuses.includes(targetStatus);
}
