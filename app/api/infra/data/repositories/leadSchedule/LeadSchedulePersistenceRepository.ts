import { ActivityType, LeadStatus, Prisma, type InviteDispatchStatus, type Lead, type LeadsSchedule } from "@prisma/client";
import { prisma } from "../../prisma";
import { buildStudioActivityData } from "@/lib/studio-feed-identity";

type CalendarResult = {
  eventId: string;
  calendarId: string;
};

export type PersistLeadScheduleInput = {
  scheduleId: string;
  leadId: string;
  closerId: string;
  meetingDate: Date;
  durationMinutes: number;
  resolvedMeetingTitle: string;
  meetingNotes?: string;
  resolvedMeetingLink: string | null;
  resolvedMeetingType: string;
  extraGuests?: string[];
  calendarResult: CalendarResult | null;
  inviteDispatchStatus: InviteDispatchStatus | null;
  inviteDispatchFallbackUsed: boolean;
  inviteDispatchLastAttemptAt: Date;
  inviteDispatchLastError: string | null;
  inviteDispatchLastPayload: Prisma.InputJsonValue | null;
  publicShareExpiresAt?: Date;
  existingSchedule: LeadsSchedule | null;
  isReschedule: boolean;
  transitionStatusToScheduled?: boolean;
  leadStatus: LeadStatus;
  authorAsStudio: boolean;
  createdByProfileId: string;
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  new_opportunity: "Nova oportunidade",
  scheduled: "Agendado",
  no_show: "No Show",
  pricingRequest: "Cotação",
  future_sale: "Venda Futura",
  offerNegotiation: "Negociação",
  pending_documents: "Documentos pendentes",
  offerSubmission: "Proposta",
  dps_agreement: "DPS | Contrato",
  invoicePayment: "Boleto",
  disqualified: "Desqualificado",
  opportunityLost: "Perdido",
  operator_denied: "Negado operadora",
  contract_finalized: "Negócio fechado",
};

function buildAuthorActivityData(
  authorAsStudio: boolean,
  createdByProfileId: string,
  input: {
    type: ActivityType;
    body: string;
    payload?: Prisma.InputJsonValue | Record<string, unknown> | null;
  },
): Prisma.LeadActivityUncheckedCreateWithoutLeadInput {
  return authorAsStudio
    ? buildStudioActivityData(input)
    : {
        type: input.type,
        body: input.body,
        payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        createdBy: createdByProfileId,
      };
}

export class LeadSchedulePersistenceRepository {
  async persist(input: PersistLeadScheduleInput): Promise<{
    schedule: LeadsSchedule;
    lead: Lead;
    message: string;
  }> {
    return prisma.$transaction(async (tx) => {
      const inviteDispatchLastPayloadForDb =
        input.inviteDispatchLastPayload === null
          ? Prisma.JsonNull
          : (input.inviteDispatchLastPayload ?? undefined);

      const schedule = await tx.leadsSchedule.upsert({
        where: { leadId: input.leadId },
        create: {
          id: input.scheduleId,
          leadId: input.leadId,
          date: input.meetingDate,
          meetingDurationMinutes: input.durationMinutes,
          meetingTitle: input.resolvedMeetingTitle,
          notes: input.meetingNotes,
          meetingLink: input.resolvedMeetingLink,
          meetingType: input.resolvedMeetingType,
          extraGuests: input.extraGuests ?? [],
          googleEventId: input.calendarResult?.eventId ?? undefined,
          googleCalendarId: input.calendarResult?.calendarId ?? undefined,
          inviteDispatchStatus: input.inviteDispatchStatus ?? undefined,
          inviteDispatchFallbackUsed: input.inviteDispatchFallbackUsed,
          inviteDispatchLastAttemptAt: input.inviteDispatchLastAttemptAt,
          inviteDispatchLastError: input.inviteDispatchLastError,
          inviteDispatchLastPayload: inviteDispatchLastPayloadForDb,
          publicShareExpiresAt: input.publicShareExpiresAt,
        },
        update: {
          date: input.meetingDate,
          meetingDurationMinutes: input.durationMinutes,
          meetingTitle: input.resolvedMeetingTitle,
          notes: input.meetingNotes,
          meetingLink: input.resolvedMeetingLink,
          meetingType: input.resolvedMeetingType,
          extraGuests: input.extraGuests ?? input.existingSchedule?.extraGuests ?? [],
          googleEventId: input.calendarResult?.eventId ?? input.existingSchedule?.googleEventId ?? undefined,
          googleCalendarId: input.calendarResult?.calendarId ?? input.existingSchedule?.googleCalendarId ?? undefined,
          inviteDispatchStatus: input.inviteDispatchStatus ?? undefined,
          inviteDispatchFallbackUsed: input.inviteDispatchFallbackUsed,
          inviteDispatchLastAttemptAt: input.inviteDispatchLastAttemptAt,
          inviteDispatchLastError: input.inviteDispatchLastError,
          inviteDispatchLastPayload: inviteDispatchLastPayloadForDb,
          publicShareExpiresAt: input.publicShareExpiresAt,
          reminder30MinSentAt:
            input.existingSchedule?.date?.getTime() !== input.meetingDate.getTime()
              ? null
              : input.existingSchedule?.reminder30MinSentAt,
        },
      });

      const lead = await tx.lead.update({
        where: { id: input.leadId },
        data: {
          meetingDate: input.meetingDate,
          meetingDurationMinutes: input.durationMinutes,
          meetingTitle: input.resolvedMeetingTitle,
          meetingNotes: input.meetingNotes || null,
          meetingLink: input.resolvedMeetingLink,
          meetingType: input.resolvedMeetingType,
          closerId: input.closerId,
          ...(input.existingSchedule?.date?.getTime() !== input.meetingDate.getTime()
            ? { meetingPresenceConfirmed: false, meetingPresenceConfirmedAt: null }
            : {}),
          ...(input.transitionStatusToScheduled === true ? { status: LeadStatus.scheduled } : {}),
        },
      });

      if (input.transitionStatusToScheduled === true && input.leadStatus !== LeadStatus.scheduled) {
        const fromLabel = STATUS_LABELS[input.leadStatus] ?? input.leadStatus;
        const toLabel = STATUS_LABELS[LeadStatus.scheduled];
        await tx.leadActivity.create({
          data: {
            leadId: input.leadId,
            ...buildAuthorActivityData(input.authorAsStudio, input.createdByProfileId, {
              type: ActivityType.status_change,
              body: `Status alterado de ${fromLabel} para ${toLabel}`,
              payload: {
                from: input.leadStatus,
                to: LeadStatus.scheduled,
                fromLabel,
                toLabel,
              },
            }),
          },
        });
      }

      return {
        schedule,
        lead,
        message: input.isReschedule ? "Agendamento atualizado com sucesso" : "Agendamento criado com sucesso",
      };
    });
  }
}

export const leadSchedulePersistenceRepository = new LeadSchedulePersistenceRepository();
