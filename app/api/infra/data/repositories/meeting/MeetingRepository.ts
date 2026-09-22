import { LeadStatus, type Prisma } from "@prisma/client";
import type { ILeadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/ILeadScheduleRepository";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import type {
  IMeetingRepository,
  UpsertMeetingWithLeadTransitionInput,
  UpsertMeetingWithLeadTransitionResult,
} from "./IMeetingRepository";

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E2. Ver `IMeetingRepository` para o
 * contexto da extração.
 */
export class MeetingRepository implements IMeetingRepository {
  constructor(
    private readonly leadScheduleRepo: ILeadScheduleRepository = leadScheduleRepository
  ) {}

  async upsertMeetingWithLeadTransition(
    tx: Prisma.TransactionClient,
    input: UpsertMeetingWithLeadTransitionInput
  ): Promise<UpsertMeetingWithLeadTransitionResult> {
    const dateChanged =
      input.existingSchedule?.date?.getTime() !== input.meetingDate.getTime();

    const schedule = await this.leadScheduleRepo.upsertByLeadIdWithTx(tx, input.leadId, {
      id: input.scheduleId,
      leadId: input.leadId,
      date: input.meetingDate,
      meetingTitle: input.meetingTitle,
      notes: input.meetingNotes,
      meetingLink: input.meetingLink,
      meetingType: input.meetingType,
      extraGuests: input.extraGuests ?? input.existingSchedule?.extraGuests ?? [],
      googleEventId: input.googleEventId ?? input.existingSchedule?.googleEventId ?? undefined,
      googleCalendarId:
        input.googleCalendarId ?? input.existingSchedule?.googleCalendarId ?? undefined,
      inviteDispatchStatus: input.inviteDispatchStatus,
      inviteDispatchFallbackUsed: input.inviteDispatchFallbackUsed,
      inviteDispatchLastAttemptAt: input.inviteDispatchLastAttemptAt,
      inviteDispatchLastError: input.inviteDispatchLastError,
      inviteDispatchLastPayload: input.inviteDispatchLastPayload,
      publicShareExpiresAt: input.publicShareExpiresAt,
      reminder30MinSentAt: dateChanged
        ? null
        : (input.existingSchedule?.reminder30MinSentAt ?? null),
    });

    const lead = await tx.lead.update({
      where: { id: input.leadId },
      data: {
        meetingDate: input.meetingDate,
        meetingTitle: input.meetingTitle,
        meetingNotes: input.meetingNotes || null,
        meetingLink: input.meetingLink,
        meetingType: input.meetingType,
        closerId: input.closerId,
        ...(dateChanged
          ? { meetingPresenceConfirmed: false, meetingPresenceConfirmedAt: null }
          : {}),
        ...(input.transitionStatusToScheduled === true
          ? { status: LeadStatus.scheduled }
          : {}),
      },
    });

    if (input.statusChangeActivity) {
      await tx.leadActivity.create({
        data: {
          leadId: input.leadId,
          ...input.statusChangeActivity,
        },
      });
    }

    return { schedule, lead };
  }
}

export const meetingRepository = new MeetingRepository();
