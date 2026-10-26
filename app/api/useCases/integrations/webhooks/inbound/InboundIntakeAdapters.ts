import { ActivityType, type Prisma } from "@prisma/client";
import { accountAccessDecisionUseCase } from "@/app/api/useCases/accountAccessDecision/AccountAccessDecisionUseCase";
import type { AccountAccessDecision } from "@/app/api/shared/accountAccessDecision/types";
import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import { leadActivityRepository } from "@/app/api/infra/data/repositories/leadActivity/LeadActivityRepository";
import { calendarAvailabilityRepository } from "@/app/api/infra/data/repositories/calendarAvailability/CalendarAvailabilityRepository";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { studioWebhookConfigRepository } from "@/app/api/infra/data/repositories/studioWebhook/StudioWebhookConfigRepository";
import { teamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository";
import { teamWebhookEventLogRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookEventLogRepository";
import { teamWebhookRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository";
import { calendarAvailabilityService } from "@/app/api/services/calendarAvailability/CalendarAvailabilityService";
import { leadDuplicateCheckService } from "@/app/api/services/leadDuplicateCheck/LeadDuplicateCheckService";
import { leadRescheduleAlertService } from "@/app/api/services/leadRescheduleAlert/LeadRescheduleAlertService";
import { leadScheduleService } from "@/app/api/services/leadSchedule/LeadScheduleService";
import { meetingSlotReservationService } from "@/app/api/services/meetingSlotReservation/MeetingSlotReservationService";
import { leadUseCase } from "@/app/api/useCases/leads/leadUseCaseFactory";
import {
  DEFAULT_TZ,
  formatLocalDateValue,
  getDayRangeInTz,
  resolveTimezone,
} from "@/lib/dates";
import { isGoogleConnectionActive } from "@/lib/google/connection";
import { buildStudioActivityData } from "@/lib/studio-feed-identity";
import type { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";
import type { InboundV2Payload } from "@/lib/webhooks/inbound/v2/payload";
import type { ProcessInboundWebhookEventDeps } from "./ProcessInboundWebhookEventUseCase";
import type { ExistingContactLead } from "./InboundIntakePorts";

const SLOT_SUGGESTION_LIMIT = 5;
const SLOT_SUGGESTION_DAYS = 7;
const SLOT_MESSAGE_UNAVAILABLE = "Este horário não está mais disponível.";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

function buildOriginPayload(payload: InboundV2Payload, eventId: string) {
  return {
    kind: "lead_creation",
    channel: "webhook",
    provider: "studio",
    webhookVersion: 2,
    source: payload.source || "studio_webhook",
    externalId: payload.externalId ?? null,
    eventId,
    metadata: (payload.metadata ?? null) as Prisma.InputJsonValue,
    submittedAt: new Date().toISOString(),
  };
}

/** Adaptadores reais das portas do processamento do webhook v2 sobre o código existente do produto. */
export function createInboundIntakeAdapters(): Omit<ProcessInboundWebhookEventDeps, "events" | "now"> {
  return {
    webhooks: {
      async getWebhook(webhookId) {
        const row = await teamWebhookRepository.findInboundById(webhookId);
        if (!row) return null;
        return {
          id: row.id,
          teamId: row.teamId,
          status: row.status,
          contractVersion: row.contractVersion,
          scopes: row.scopes ?? [],
          defaultMeetingLink: row.defaultMeetingLink,
        };
      },
    },

    teams: {
      async getTeam(teamId) {
        const team = await studioWebhookConfigRepository.getTeamWithMaster(teamId);
        if (!team?.master.supabaseId) return null;
        return { teamId: team.id, managerProfileId: team.master.id, managerSupabaseId: team.master.supabaseId };
      },
      async isAccountAllowed(team) {
        const access = await accountAccessDecisionUseCase.execute({
          profileId: team.managerProfileId,
          teamId: team.teamId,
        });
        const decision = access.result as AccountAccessDecision | null;
        return access.isValid && decision?.state === "allowed";
      },
    },

    contacts: {
      async findExistingContact(teamId, contact) {
        const candidates = await leadDuplicateCheckService.findCandidates(
          { profileId: "", teamMember: { role: "manager", functions: [] } },
          { teamId, phone: contact.phone, email: contact.email },
        );
        const ids = new Map<string, Date>(candidates.map((candidate) => [candidate.id, candidate.createdAt]));

        if (contact.cnpj) {
          const byCnpj = await leadRepository.findCnpjConflictInTeam({ teamId, cnpj: contact.cnpj });
          if (byCnpj && !ids.has(byCnpj.id)) ids.set(byCnpj.id, new Date(0));
        }
        if (ids.size === 0) return null;

        // Havendo mais de um lead, vale o mais recente (DA6).
        const loaded = (await Promise.all([...ids.keys()].map((id) => leadRepository.findById(id)))).filter(
          (lead): lead is NonNullable<typeof lead> => lead !== null && lead.deletedAt === null && lead.teamId === teamId,
        );
        if (loaded.length === 0) return null;
        loaded.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        const lead = loaded[0];
        const existing: ExistingContactLead = {
          id: lead.id,
          leadCode: lead.leadCode,
          name: lead.name,
          status: lead.status,
          email: lead.email,
          phone: lead.phone,
          cnpj: lead.cnpj,
          notes: lead.notes,
          assignedTo: lead.assignedTo,
          createdAt: lead.createdAt,
        };
        return existing;
      },
    },

    assignees: {
      claimNextAssignee: (webhookId) => teamWebhookRepository.claimNextRoundRobinAssignee(webhookId),
      isValidSdr: (teamId, profileId) => teamMembersRepository.isActiveSdr(teamId, profileId),
    },

    leads: {
      async create({ team, payload, assignedTo, eventId }) {
        const activityPayload = buildOriginPayload(payload, eventId);
        const leadData: CreateLeadRequest = {
          name: payload.lead.name,
          email: payload.lead.email,
          phone: payload.lead.phone,
          cnpj: payload.lead.cnpj,
          age: undefined,
          currentHealthPlan: undefined,
          currentValue: undefined,
          referenceHospital: undefined,
          currentTreatment: undefined,
          meetingDate: undefined,
          meetingTitle: undefined,
          meetingNotes: undefined,
          meetingLink: undefined,
          notes: payload.lead.notes,
          assignedTo: assignedTo ?? undefined,
          closerId: undefined,
          ticket: undefined,
          contractDueDate: undefined,
          soldPlan: undefined,
          // A duplicata já foi resolvida pela regra do webhook (DA6): contato existente em outro
          // status gera lead novo de propósito; o índice único parcial é a barreira final.
          confirmDuplicate: true,
          originChannel: "studio_webhook",
          originMetadata: activityPayload,
        };

        const output = await leadUseCase.createLead(
          team.managerSupabaseId,
          leadData,
          team.teamId,
          { authorAsStudio: true, body: "Lead criado via webhook v2", payload: activityPayload },
          { autoScheduleMeeting: false },
        );

        if (!output.isValid) {
          const result = output.result as { isDuplicateConflict?: boolean } | null;
          return {
            ok: false as const,
            reason: result?.isDuplicateConflict ? ("duplicate_conflict" as const) : ("failed" as const),
            message: output.errorMessages.join("; "),
          };
        }

        const created = output.result as { id: string; leadCode: string | null };
        return {
          ok: true as const,
          lead: { id: created.id, leadCode: created.leadCode, name: payload.lead.name, email: payload.lead.email ?? null },
        };
      },

      async merge({ existing, payload, eventId }) {
        // D40: campo vazio recebe o valor novo; preenchido não é sobrescrito; notas são acrescentadas;
        // o SDR responsável não muda.
        const patch: Record<string, unknown> = {};
        const changedFields: string[] = [];
        if (!existing.email && payload.lead.email) {
          patch.email = payload.lead.email;
          changedFields.push("email");
        }
        if (!existing.phone && payload.lead.phone) {
          patch.phone = payload.lead.phone;
          changedFields.push("phone");
        }
        if (!existing.cnpj && payload.lead.cnpj) {
          patch.cnpj = payload.lead.cnpj;
          changedFields.push("cnpj");
        }
        if (payload.lead.notes) {
          patch.notes = existing.notes ? `${existing.notes}\n\n${payload.lead.notes}` : payload.lead.notes;
          changedFields.push("notes");
        }

        if (changedFields.length > 0) await leadRepository.update(existing.id, patch);

        await leadActivityRepository.create({
          leadId: existing.id,
          ...buildStudioActivityData({
            type: ActivityType.note,
            body: "Informações recebidas pelo webhook",
            payload: {
              kind: "webhook_merge",
              eventId,
              changedFields,
              source: payload.source ?? null,
              metadata: (payload.metadata ?? null) as Prisma.InputJsonValue,
            },
          }),
        });

        return { changedFields };
      },
    },

    schedule: {
      isEligibleCloser: (teamId, closerProfileId) =>
        meetingSlotReservationService.isCloserEligibleForTeam(teamId, closerProfileId),

      async closerHasActiveGoogle(closerProfileId) {
        const closer = await profileRepository.findWithGoogleConnectionById(closerProfileId);
        return Boolean(closer && isGoogleConnectionActive(closer.googleConnection));
      },

      async filterTeamMemberEmails(teamId, emails) {
        const members = await teamMembersRepository.findGoogleConnectionStatusByEmails(teamId, emails);
        const memberEmails = new Set(members.map((member) => normalizeEmail(member.email)));
        return emails.map(normalizeEmail).filter((email) => memberEmails.has(email));
      },

      async createSchedule(request) {
        const assignee = request.lead.assignedTo
          ? await profileRepository.findContactById(request.lead.assignedTo)
          : null;
        const output = await leadScheduleService.createSchedule({
          leadId: request.lead.id,
          leadName: request.lead.name,
          leadEmail: request.lead.email,
          leadStatus: request.lead.status ?? "new_opportunity",
          leadManagerId: request.team.managerProfileId,
          leadAssignedTo: request.lead.assignedTo,
          leadAssigneeEmail: assignee?.email ?? null,
          leadCurrentCloserId: null,
          leadCode: request.lead.leadCode,
          closerId: request.closerProfileId,
          teamId: request.team.teamId,
          meetingDate: request.startsAt.toISOString(),
          meetingTitle: request.title?.trim() || `Estudo Plano de Saúde: ${request.lead.name}`,
          meetingNotes: request.notes,
          meetingLink: request.meetingLink,
          meetingType: request.type,
          reservationSource: "internal",
          extraGuests: request.guests,
          createdByProfileId: request.team.managerProfileId,
          transitionStatusToScheduled: true,
          authorAsStudio: true,
        });

        if (output.isValid) return { ok: true as const };
        const message = output.errorMessages.join("; ");
        return {
          ok: false as const,
          reason: message.includes(SLOT_MESSAGE_UNAVAILABLE) ? ("slot_unavailable" as const) : ("failed" as const),
          message,
        };
      },

      async findConflictingLeadId(teamId, closerProfileId, startsAt) {
        const duration = (await calendarAvailabilityRepository.findMeetingDuration(teamId)) ?? 30;
        return calendarAvailabilityRepository.findConflictingLeadId({
          closerId: closerProfileId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + duration * 60 * 1000),
        });
      },

      async suggestSlots({ teamId, closerProfileId, from }) {
        const closer = await profileRepository.findWithGoogleConnectionById(closerProfileId);
        const timezone = resolveTimezone(closer?.timezone ?? DEFAULT_TZ);
        const found: Array<{ startsAt: string; endsAt: string }> = [];

        let dateKey = formatLocalDateValue(from, timezone);
        for (let day = 0; day < SLOT_SUGGESTION_DAYS && found.length < SLOT_SUGGESTION_LIMIT; day += 1) {
          const availability = await calendarAvailabilityService.getAvailability({
            teamId,
            requestedCloserIds: [closerProfileId],
            date: dateKey,
            userTimezone: timezone,
          });
          const range = getDayRangeInTz(dateKey, timezone);
          for (const time of availability.perCloser[closerProfileId] ?? []) {
            const [hours, minutes] = time.split(":").map(Number);
            const startsAt = new Date(range.start.getTime() + (hours * 60 + minutes) * 60 * 1000);
            if (startsAt.getTime() <= from.getTime()) continue;
            found.push({
              startsAt: startsAt.toISOString(),
              endsAt: new Date(startsAt.getTime() + availability.durationMinutes * 60 * 1000).toISOString(),
            });
            if (found.length >= SLOT_SUGGESTION_LIMIT) break;
          }
          dateKey = formatLocalDateValue(range.end, timezone);
        }
        return found;
      },
    },

    alerts: {
      async flag(input) {
        await leadRescheduleAlertService.flag({
          teamId: input.team.teamId,
          leadId: input.lead.id,
          leadCode: input.lead.leadCode,
          leadName: input.lead.name,
          reasonCode: input.reasonCode,
          requestedStartsAt: input.requestedStartsAt,
          requestedCloserId: input.requestedCloserId,
          conflictingLeadId: input.conflictingLeadId,
          suggestedSlots: input.suggestedSlots,
          sourceEventId: input.sourceEventId,
          // SDR responsável, closer pedido e manager do time (DA9).
          recipientProfileIds: [input.lead.assignedTo, input.requestedCloserId, input.team.managerProfileId],
        });
      },
    },

    eventLog: {
      async record(input) {
        await teamWebhookEventLogRepository.create({
          teamId: input.teamId,
          webhookId: input.webhookId,
          direction: "inbound",
          result: input.result,
          method: "POST",
          endpoint: `/api/webhooks/studio/v2/${input.teamId}`,
          statusCode: 202,
          requestPayload: input.requestPayload,
          responsePayload: input.responsePayload,
          errorMessage: input.errorMessage,
        });
      },
      touchUsage: (webhookId, success) => teamWebhookRepository.touchUsage(webhookId, success),
    },
  };
}

