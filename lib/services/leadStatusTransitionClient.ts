export type LeadStatusTransitionBlockerType =
  | "sales_info"
  | "confirmation"
  | "meeting_heald"
  | "schedule_required"
  | "finalize_contract"
  | "future_sale_trigger"
  | "loss_reason_trigger"
  | "disabled_status"
  | "validation_error"
  | "email_required"
  | "lead_info_required"
  | "none";

export interface LeadStatusTransitionResultPayload {
  transition: {
    allowed: boolean;
    blockerType: LeadStatusTransitionBlockerType;
    sourceStatus?: string;
    targetStatus?: string;
    missingFields?: Array<"ticket" | "contractDueDate" | "soldPlan">;
    missingLeadFields?: Array<"age" | "currentHealthPlan" | "referenceHospital" | "ongoingTreatment">;
    currentLeadInfo?: {
      age: string | null;
      currentHealthPlan: string | null;
      referenceHospital: string | null;
      ongoingTreatment: string | null;
    };
    confirmationRuleId?: string | null;
    confirmationMessage?: string | null;
    canConfirmMeetingHeald?: boolean;
    allowNoShow?: boolean;
    meetingDate?: string | null;
    currentSalesInfo?: {
      ticket: number | null;
      contractDueDate: string | null;
      soldPlan: string | null;
    };
    message?: string;
  };
  [key: string]: unknown;
}

export interface LeadStatusTransitionOutput {
  isValid: boolean;
  successMessages: string[];
  errorMessages: string[];
  result: LeadStatusTransitionResultPayload | null;
}

type TransitionMode = "validate" | "apply";

export interface LeadStatusTransitionRequest {
  leadId: string;
  targetStatus: string;
  supabaseId?: string;
  teamId?: string | null;
  trigger?: LeadStatusTransitionTrigger;
}

export interface LeadStatusTransitionTrigger {
  followUpAt?: string;
  followUpNotes?: string;
  reason?: string;
  reasonDetails?: string;
  confirmRuleId?: string;
  meetingHeald?: "yes" | "no" | null;
}

export interface LeadStatusTransitionResponse {
  httpStatus: number;
  output: LeadStatusTransitionOutput;
  transition: LeadStatusTransitionResultPayload["transition"];
}

const defaultTransition = (targetStatus: string): LeadStatusTransitionResultPayload["transition"] => ({
  allowed: false,
  blockerType: "validation_error",
  targetStatus,
});

const resolveTransition = (
  output: LeadStatusTransitionOutput,
  targetStatus: string
): LeadStatusTransitionResultPayload["transition"] => {
  if (output?.result?.transition) {
    return output.result.transition;
  }

  const legacyResult = (output?.result ?? {}) as Record<string, unknown>;
  if (legacyResult.requiresSalesInfo) {
    return { allowed: false, blockerType: "sales_info", targetStatus };
  }
  if (legacyResult.requiresMeetingHeald) {
    return { allowed: false, blockerType: "meeting_heald", targetStatus };
  }
  if (legacyResult.requiresConfirmation) {
    return { allowed: false, blockerType: "confirmation", targetStatus };
  }
  if (legacyResult.requiresFinalizeContract) {
    return { allowed: false, blockerType: "finalize_contract", targetStatus };
  }

  return output.isValid
    ? { allowed: true, blockerType: "none", targetStatus }
    : defaultTransition(targetStatus);
};

const callStatusTransition = async (
  mode: TransitionMode,
  request: LeadStatusTransitionRequest
): Promise<LeadStatusTransitionResponse> => {
  const response = await fetch(`/api/v1/leads/${request.leadId}/status-transition`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(request.supabaseId ? { "x-supabase-user-id": request.supabaseId } : {}),
      ...(request.teamId ? { "x-team-id": request.teamId } : {}),
    },
    body: JSON.stringify({
      mode,
      targetStatus: request.targetStatus,
      trigger: request.trigger,
    }),
  });

  const output = (await response.json().catch(() => null)) as LeadStatusTransitionOutput | null;
  const safeOutput: LeadStatusTransitionOutput = output ?? {
    isValid: false,
    successMessages: [],
    errorMessages: ["Erro ao processar transição de status."],
    result: null,
  };

  return {
    httpStatus: response.status,
    output: safeOutput,
    transition: resolveTransition(safeOutput, request.targetStatus),
  };
};

export const leadStatusTransitionClient = {
  validateStatusTransition: (request: LeadStatusTransitionRequest) =>
    callStatusTransition("validate", request),
  applyStatusTransition: (request: LeadStatusTransitionRequest) =>
    callStatusTransition("apply", request),
  executeStatusTransition: async (request: LeadStatusTransitionRequest) => {
    const validation = await callStatusTransition("validate", request);
    if (!validation.transition.allowed) return validation;
    return callStatusTransition("apply", request);
  },
};
