import type {
  BackofficeLeadTransitionGateType,
  LeadStatus,
} from "@prisma/client";

export type LeadStatusTransitionGateBlockerType =
  | "sales_info"
  | "meeting_heald"
  | "schedule_required"
  | "finalize_contract"
  | "future_sale_trigger"
  | "loss_reason_trigger"
  | "validation_error"
  | "email_required";

export type LeadStatusTransitionGateRow = {
  id: string;
  slug: string;
  name: string;
  gateType: BackofficeLeadTransitionGateType;
  sourceStatus: LeadStatus | null;
  targetStatus: LeadStatus | null;
  config: unknown;
  blockerType: string;
  errorMessage: string | null;
  isEnabled: boolean;
  sortOrder: number;
};

export type AllowedTargetStatusesConfig = {
  allowedTargetStatuses: LeadStatus[];
};

export type BlockTargetsWhenFieldEqualsConfig = {
  field: "meetingHeald";
  equals: string;
  blockedTargetStatuses: LeadStatus[];
};

export type RequireMeetingHealdOnExitConfig = {
  exemptTargetStatuses: LeadStatus[];
};

export type RequireSalesInfoConfig = {
  targetStatuses: LeadStatus[];
};

export type RequireFinalizeContractConfig = {
  targetStatuses: LeadStatus[];
};

export type RequireFinalizeContractFlowConfig = {
  validateModeOnly?: boolean;
};

export const GATE_TYPE_LABELS: Record<BackofficeLeadTransitionGateType, string> = {
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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown): LeadStatus[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is LeadStatus => typeof item === "string");
}

export function parseAllowedTargetStatusesConfig(
  config: unknown
): AllowedTargetStatusesConfig {
  if (!isRecord(config)) return { allowedTargetStatuses: [] };
  return {
    allowedTargetStatuses: readStringArray(config.allowedTargetStatuses),
  };
}

export function parseBlockTargetsWhenFieldEqualsConfig(
  config: unknown
): BlockTargetsWhenFieldEqualsConfig {
  if (!isRecord(config)) {
    return { field: "meetingHeald", equals: "yes", blockedTargetStatuses: [] };
  }
  return {
    field: "meetingHeald",
    equals: typeof config.equals === "string" ? config.equals : "yes",
    blockedTargetStatuses: readStringArray(config.blockedTargetStatuses),
  };
}

export function parseRequireMeetingHealdOnExitConfig(
  config: unknown
): RequireMeetingHealdOnExitConfig {
  if (!isRecord(config)) return { exemptTargetStatuses: [] };
  return {
    exemptTargetStatuses: readStringArray(config.exemptTargetStatuses),
  };
}

export function parseRequireSalesInfoConfig(config: unknown): RequireSalesInfoConfig {
  if (!isRecord(config)) return { targetStatuses: [] };
  return { targetStatuses: readStringArray(config.targetStatuses) };
}

export function parseRequireFinalizeContractConfig(
  config: unknown
): RequireFinalizeContractConfig {
  if (!isRecord(config)) return { targetStatuses: [] };
  return { targetStatuses: readStringArray(config.targetStatuses) };
}

export function parseRequireFinalizeContractFlowConfig(
  config: unknown
): RequireFinalizeContractFlowConfig {
  if (!isRecord(config)) return {};
  return {
    validateModeOnly: config.validateModeOnly === true,
  };
}

export function gateMatchesTransition(
  gate: Pick<LeadStatusTransitionGateRow, "sourceStatus" | "targetStatus">,
  sourceStatus: LeadStatus,
  targetStatus: LeadStatus
): boolean {
  if (gate.sourceStatus && gate.sourceStatus !== sourceStatus) return false;
  if (gate.targetStatus && gate.targetStatus !== targetStatus) return false;
  return true;
}

export function getAllowedTargetStatusesFromGates(
  gates: LeadStatusTransitionGateRow[],
  sourceStatus: LeadStatus
): LeadStatus[] | null {
  const gate = gates.find(
    (item) =>
      item.isEnabled &&
      item.gateType === "allowed_target_statuses" &&
      item.sourceStatus === sourceStatus
  );
  if (!gate) return null;
  return parseAllowedTargetStatusesConfig(gate.config).allowedTargetStatuses;
}

export function isTransitionAllowedByGates(
  gates: LeadStatusTransitionGateRow[],
  sourceStatus: LeadStatus,
  targetStatus: LeadStatus
): boolean {
  if (sourceStatus === targetStatus) return true;
  const allowed = getAllowedTargetStatusesFromGates(gates, sourceStatus);
  if (!allowed) return true;
  return allowed.includes(targetStatus);
}

export function filterSelectableStatusLabelsFromGates(
  sourceStatus: string,
  statusLabels: Record<string, string>,
  gates: LeadStatusTransitionGateRow[]
): Array<[string, string]> {
  const entries = Object.entries(statusLabels);
  const allowed = getAllowedTargetStatusesFromGates(
    gates,
    sourceStatus as LeadStatus
  );
  if (!allowed) return entries;
  const allowedSet = new Set<string>(allowed);
  return entries.filter(([value]) => allowedSet.has(value));
}
