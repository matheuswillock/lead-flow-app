import type { InviteDispatchStatus, LeadStatus, Prisma } from "@prisma/client";
import { leadFinalizedRepository } from "@/app/api/infra/data/repositories/leadFinalized/LeadFinalizedRepository";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { backofficeLeadStatusTransitionGateRepository } from "@/app/api/infra/data/repositories/backofficeLeadStatusTransitionGate/BackofficeLeadStatusTransitionGateRepository";
import type { LeadStatusTransitionMode, UpdateLeadStatusTriggerInput } from "@/app/api/useCases/leads/ILeadUseCase";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache/cacheTags";
import {
  gateMatchesTransition,
  parseAllowedTargetStatusesConfig,
  parseBlockTargetsWhenFieldEqualsConfig,
  parseRequireCloserConfig,
  parseRequireFinalizeContractConfig,
  parseRequireFinalizeContractFlowConfig,
  parseRequireMeetingHealdOnExitConfig,
  parseRequireSalesInfoConfig,
  type LeadStatusTransitionGateRow,
} from "@/lib/leadStatusTransitionGates";

const SCHEDULED_INVITE_SUCCESS_STATUSES: InviteDispatchStatus[] = ["sent_google", "sent_resend"];

type LeadForGateEvaluation = {
  id: string;
  status: LeadStatus | null;
  teamId: string | null;
  closerId: string | null;
  meetingDate: Date | null;
  meetingType: string | null;
  meetingLink: string | null;
  meetingHeald: string | null;
  email: string | null;
  ticket: Prisma.Decimal | null;
  contractDueDate: Date | null;
  soldPlan: string | null;
};

type GateEvaluationProfile = {
  id: string;
};

export type TransitionGateBlockerType =
  | "sales_info"
  | "meeting_heald"
  | "schedule_required"
  | "finalize_contract"
  | "future_sale_trigger"
  | "loss_reason_trigger"
  | "validation_error"
  | "email_required"
  | "closer_required";

export type TransitionGateEvaluationBlock = {
  errorMessages: string[];
  blockerType: TransitionGateBlockerType;
  result: Record<string, unknown>;
};

export type TransitionGateEvaluationSuccess = {
  statusUpdatePatch: Prisma.LeadUpdateInput;
};

async function listEnabledGatesCached(): Promise<LeadStatusTransitionGateRow[]> {
  "use cache";
  cacheTag(cacheTags.leadStatusTransitionGates());
  cacheLife("minutes");
  return backofficeLeadStatusTransitionGateRepository.listEnabled();
}

function asBlockerType(value: string): TransitionGateBlockerType {
  const allowed: TransitionGateBlockerType[] = [
    "sales_info",
    "meeting_heald",
    "schedule_required",
    "finalize_contract",
    "future_sale_trigger",
    "loss_reason_trigger",
    "validation_error",
    "email_required",
    "closer_required",
  ];
  return allowed.includes(value as TransitionGateBlockerType)
    ? (value as TransitionGateBlockerType)
    : "validation_error";
}

export class LeadStatusTransitionGateEvaluatorService {
  async listEnabledGates(): Promise<LeadStatusTransitionGateRow[]> {
    return listEnabledGatesCached();
  }

  async evaluate(params: {
    lead: LeadForGateEvaluation;
    targetStatus: LeadStatus;
    trigger?: UpdateLeadStatusTriggerInput;
    mode: LeadStatusTransitionMode;
    profileInfo: GateEvaluationProfile;
    createTransition: (
      allowed: boolean,
      blockerType: TransitionGateBlockerType,
      extra?: Record<string, unknown>
    ) => Record<string, unknown>;
    sortOrderRange?: { min?: number; max?: number };
  }): Promise<TransitionGateEvaluationSuccess | TransitionGateEvaluationBlock> {
    const gates = await this.listEnabledGates();
    const statusUpdatePatch: Prisma.LeadUpdateInput = {};
    const sourceStatus = params.lead.status;
    const minSort = params.sortOrderRange?.min ?? Number.NEGATIVE_INFINITY;
    const maxSort = params.sortOrderRange?.max ?? Number.POSITIVE_INFINITY;

    if (!sourceStatus) {
      return { statusUpdatePatch };
    }

    for (const gate of gates) {
      if (gate.sortOrder < minSort || gate.sortOrder > maxSort) continue;
      if (!gateMatchesTransition(gate, sourceStatus, params.targetStatus)) {
        continue;
      }

      const block = await this.evaluateGate(gate, params, statusUpdatePatch);
      if (block) {
        return block;
      }
    }

    return { statusUpdatePatch };
  }

  private async evaluateGate(
    gate: LeadStatusTransitionGateRow,
    params: {
      lead: LeadForGateEvaluation;
      targetStatus: LeadStatus;
      trigger?: UpdateLeadStatusTriggerInput;
      mode: LeadStatusTransitionMode;
      profileInfo: GateEvaluationProfile;
      createTransition: (
        allowed: boolean,
        blockerType: TransitionGateBlockerType,
        extra?: Record<string, unknown>
      ) => Record<string, unknown>;
    },
    statusUpdatePatch: Prisma.LeadUpdateInput
  ): Promise<TransitionGateEvaluationBlock | null> {
    const { lead, targetStatus, trigger, mode, profileInfo, createTransition } = params;
    const blockerType = asBlockerType(gate.blockerType);
    const message =
      gate.errorMessage?.trim() ||
      "Não foi possível concluir a mudança de status.";

    switch (gate.gateType) {
      case "require_finalize_contract_flow": {
        if (targetStatus !== "contract_finalized") return null;
        return {
          errorMessages: [message],
          blockerType,
          result: {
            requiresFinalizeContract: true,
            sourceStatus: lead.status,
            targetStatus,
            transition: createTransition(false, blockerType),
          },
        };
      }

      case "allowed_target_statuses": {
        if (targetStatus === lead.status) return null;
        const { allowedTargetStatuses } = parseAllowedTargetStatusesConfig(gate.config);
        if (allowedTargetStatuses.includes(targetStatus)) return null;
        return {
          errorMessages: [message],
          blockerType,
          result: {
            transition: createTransition(false, blockerType),
          },
        };
      }

      case "block_targets_when_field_equals": {
        const config = parseBlockTargetsWhenFieldEqualsConfig(gate.config);
        const fieldValue =
          config.field === "meetingHeald" ? lead.meetingHeald : null;
        if (fieldValue !== config.equals) return null;
        if (!config.blockedTargetStatuses.includes(targetStatus)) return null;
        return {
          errorMessages: [message],
          blockerType,
          result: {
            transition: createTransition(false, blockerType),
          },
        };
      }

      case "require_sales_info": {
        const config = parseRequireSalesInfoConfig(gate.config);
        if (!config.targetStatuses.includes(targetStatus)) return null;

        const missingFields: Array<"ticket" | "contractDueDate" | "soldPlan"> = [];
        const hasValidTicket =
          lead.ticket !== null &&
          lead.ticket !== undefined &&
          !Number.isNaN(Number(lead.ticket)) &&
          Number(lead.ticket) > 0;

        if (!hasValidTicket) missingFields.push("ticket");
        if (!lead.contractDueDate) missingFields.push("contractDueDate");
        if (!lead.soldPlan?.trim()) missingFields.push("soldPlan");

        if (missingFields.length === 0) return null;

        const currentSalesInfo = {
          ticket: lead.ticket ? Number(lead.ticket) : null,
          contractDueDate: lead.contractDueDate ? lead.contractDueDate.toISOString() : null,
          soldPlan: lead.soldPlan || null,
        };

        return {
          errorMessages: [message],
          blockerType,
          result: {
            requiresSalesInfo: true,
            missingFields,
            sourceStatus: lead.status,
            targetStatus,
            currentSalesInfo,
            transition: createTransition(false, blockerType, {
              missingFields,
              currentSalesInfo,
            }),
          },
        };
      }

      case "require_closer": {
        const config = parseRequireCloserConfig(gate.config);
        if (!config.targetStatuses.includes(targetStatus)) return null;
        if (lead.closerId) return null;

        return {
          errorMessages: [message],
          blockerType: "closer_required",
          result: {
            requiresCloser: true,
            sourceStatus: lead.status,
            targetStatus,
            currentCloserId: null,
            transition: createTransition(false, "closer_required", {
              currentCloserId: null,
            }),
          },
        };
      }

      case "require_finalize_contract": {
        const config = parseRequireFinalizeContractConfig(gate.config);
        if (!config.targetStatuses.includes(targetStatus)) return null;

        const finalizedContract = await leadFinalizedRepository.findLatestByLeadId(lead.id);
        if (finalizedContract) return null;

        return {
          errorMessages: [message],
          blockerType,
          result: {
            requiresFinalizeContract: true,
            sourceStatus: lead.status,
            targetStatus,
            transition: createTransition(false, blockerType),
          },
        };
      }

      case "require_no_show_preconditions": {
        if (!lead.meetingDate) {
          return {
            errorMessages: ["Lead precisa ter um agendamento para marcar no-show."],
            blockerType: "validation_error",
            result: {
              transition: createTransition(false, "validation_error"),
            },
          };
        }
        if (lead.meetingDate.getTime() > Date.now()) {
          return {
            errorMessages: ["Não é possível marcar no-show antes do horário agendado."],
            blockerType: "validation_error",
            result: {
              transition: createTransition(false, "validation_error"),
            },
          };
        }
        return null;
      }

      case "require_meeting_heald_on_exit": {
        const config = parseRequireMeetingHealdOnExitConfig(gate.config);
        if (config.exemptTargetStatuses.includes(targetStatus)) return null;
        if (lead.meetingHeald === "yes") return null;

        const masterId = lead.teamId
          ? await backofficeLeadStatusTransitionGateRepository.findTeamMasterId(lead.teamId)
          : null;
        const isTeamMaster = !!(masterId && masterId === profileInfo.id);
        const isAssignedCloser = !!lead.closerId && lead.closerId === profileInfo.id;
        const canConfirmMeetingHeald = isTeamMaster || isAssignedCloser;
        const allowNoShow =
          !!lead.meetingDate && lead.meetingDate.getTime() <= Date.now();

        const wantsMarkMeetingHeald = trigger?.meetingHeald === "yes";
        if (!wantsMarkMeetingHeald) {
          return {
            errorMessages: [message],
            blockerType: "meeting_heald",
            result: {
              requiresMeetingHeald: true,
              canConfirmMeetingHeald,
              allowNoShow,
              meetingDate: lead.meetingDate ? lead.meetingDate.toISOString() : null,
              transition: createTransition(false, "meeting_heald", {
                canConfirmMeetingHeald,
                allowNoShow,
                meetingDate: lead.meetingDate ? lead.meetingDate.toISOString() : null,
              }),
            },
          };
        }

        if (!canConfirmMeetingHeald) {
          return {
            errorMessages: [
              "Acesso negado: somente o master ou o closer do lead pode marcar a reunião como realizada.",
            ],
            blockerType: "meeting_heald",
            result: {
              requiresMeetingHeald: true,
              canConfirmMeetingHeald: false,
              allowNoShow,
              meetingDate: lead.meetingDate ? lead.meetingDate.toISOString() : null,
              transition: createTransition(false, "meeting_heald", {
                canConfirmMeetingHeald: false,
                allowNoShow,
                meetingDate: lead.meetingDate ? lead.meetingDate.toISOString() : null,
              }),
            },
          };
        }

        statusUpdatePatch.meetingHeald = "yes";
        return null;
      }

      case "require_schedule_artifacts": {
        const latestSchedule = await leadScheduleRepository.findLatestByLeadId(lead.id);
        const resolvedMeetingType = (latestSchedule?.meetingType || lead.meetingType || "online") as
          | "online"
          | "call"
          | "whatsapp";
        const resolvedMeetingLink =
          latestSchedule?.meetingLink?.trim() || lead.meetingLink?.trim() || "";
        const inviteDispatchSuccessful = latestSchedule?.inviteDispatchStatus
          ? SCHEDULED_INVITE_SUCCESS_STATUSES.includes(latestSchedule.inviteDispatchStatus)
          : false;
        const requiresOnlineArtifacts = resolvedMeetingType === "online";

        if (
          !lead.meetingDate ||
          !lead.closerId ||
          (requiresOnlineArtifacts && (!resolvedMeetingLink || !inviteDispatchSuccessful))
        ) {
          return {
            errorMessages: [message],
            blockerType,
            result: {
              transition: createTransition(false, blockerType),
            },
          };
        }
        return null;
      }

      case "require_email_for_online_schedule": {
        const latestSchedule = await leadScheduleRepository.findLatestByLeadId(lead.id);
        const resolvedMeetingType = (latestSchedule?.meetingType || lead.meetingType || "online") as
          | "online"
          | "call"
          | "whatsapp";
        if (resolvedMeetingType !== "online") return null;
        if (lead.email?.trim()) return null;
        return {
          errorMessages: [message],
          blockerType,
          result: {
            transition: createTransition(false, blockerType),
          },
        };
      }

      case "require_trigger_future_sale": {
        const followUpAt = trigger?.followUpAt ? new Date(trigger.followUpAt) : null;
        if (followUpAt && !Number.isNaN(followUpAt.getTime())) {
          statusUpdatePatch.followUpAt = followUpAt;
          statusUpdatePatch.followUpNotes = trigger?.followUpNotes?.trim() || null;
          statusUpdatePatch.followUpSourceStatus = lead.status;
          return null;
        }
        return {
          errorMessages: [message],
          blockerType,
          result: {
            transition: createTransition(false, blockerType),
          },
        };
      }

      case "require_trigger_loss_reason": {
        const reason = trigger?.reason?.trim() || "";
        if (!reason) {
          return {
            errorMessages: [message],
            blockerType,
            result: {
              transition: createTransition(false, blockerType),
            },
          };
        }
        statusUpdatePatch.lossReason = reason;
        statusUpdatePatch.lossReasonDetails = trigger?.reasonDetails?.trim() || null;
        return null;
      }

      default:
        return null;
    }
  }
}

export const leadStatusTransitionGateEvaluatorService =
  new LeadStatusTransitionGateEvaluatorService();
