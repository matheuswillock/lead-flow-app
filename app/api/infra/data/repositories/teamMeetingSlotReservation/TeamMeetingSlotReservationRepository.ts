import { Prisma, TeamMeetingSlotReservationState } from "@prisma/client";
import { prisma } from "../../prisma";
import type {
  CreateTeamMeetingSlotReservationInput,
  ITeamMeetingSlotReservationRepository,
  TeamMeetingSlotReservationResult,
} from "./ITeamMeetingSlotReservationRepository";

export const MAX_RECOVERY_ATTEMPTS = 20;

export class TeamMeetingSlotReservationRepository implements ITeamMeetingSlotReservationRepository {
  async reserve(input: CreateTeamMeetingSlotReservationInput): Promise<TeamMeetingSlotReservationResult> {
    return prisma.$transaction(async (transaction) => {
      const lockKey = `${input.teamId}:${input.closerId}`;
      await transaction.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

      const conflictingReservation = await transaction.teamMeetingSlotReservation.findFirst({
        where: {
          teamId: input.teamId,
          closerId: input.closerId,
          state: { in: [TeamMeetingSlotReservationState.reserved, TeamMeetingSlotReservationState.consumed] },
          startsAt: { lt: input.endsAt },
          endsAt: { gt: input.startsAt },
          ...(input.leadId ? { NOT: { leadId: input.leadId } } : {}),
        },
        select: { id: true },
      });
      if (conflictingReservation) return { available: false };

      const conflictingLeads = await transaction.lead.findMany({
        where: {
          teamId: input.teamId,
          closerId: input.closerId,
          status: "scheduled",
          meetingDate: { gte: new Date(input.startsAt.getTime() - 60 * 60 * 1000), lt: input.endsAt },
          ...(input.leadId ? { NOT: { id: input.leadId } } : {}),
        },
        select: { id: true, meetingDate: true, meetingDurationMinutes: true },
      });
      if (conflictingLeads.some((lead) => {
        if (!lead.meetingDate) return false;
        const duration = lead.meetingDurationMinutes ?? 30;
        const conflictEndsAt = new Date(lead.meetingDate.getTime() + duration * 60 * 1000);
        return lead.meetingDate < input.endsAt && conflictEndsAt > input.startsAt;
      })) {
        return { available: false };
      }

      const reservation = await transaction.teamMeetingSlotReservation.create({ data: input });
      return { available: true, reservationId: reservation.id };
    });
  }

  async consume(input: { reservationId: string; leadId?: string | null; googleEventId?: string | null; googleCalendarId?: string | null }): Promise<void> {
    await prisma.teamMeetingSlotReservation.update({
      where: { id: input.reservationId },
      data: {
        state: TeamMeetingSlotReservationState.consumed,
        consumedAt: new Date(),
        leadId: input.leadId ?? undefined,
        googleEventId: input.googleEventId ?? undefined,
        googleCalendarId: input.googleCalendarId ?? undefined,
      },
    });
  }

  async attachToPublicFormSubmission(input: { reservationId: string; publicFormSubmissionId: string }): Promise<void> {
    await prisma.teamMeetingSlotReservation.update({
      where: { id: input.reservationId },
      data: { publicFormSubmissionId: input.publicFormSubmissionId },
    });
  }

  async attachToLead(input: { reservationId: string; leadId: string }): Promise<void> {
    await prisma.teamMeetingSlotReservation.update({
      where: { id: input.reservationId },
      data: { leadId: input.leadId },
    });
  }

  async markExternalEvent(input: { reservationId: string; googleEventId: string; googleCalendarId: string }): Promise<void> {
    await prisma.teamMeetingSlotReservation.updateMany({
      where: { id: input.reservationId, state: TeamMeetingSlotReservationState.reserved },
      data: { googleEventId: input.googleEventId, googleCalendarId: input.googleCalendarId },
    });
  }

  async findRecoverable(limit: number) {
    return prisma.teamMeetingSlotReservation.findMany({
      where: {
        state: TeamMeetingSlotReservationState.reserved,
        googleEventId: { not: null },
        googleCalendarId: { not: null },
        recoveryAttempts: { lt: MAX_RECOVERY_ATTEMPTS },
      },
      select: { id: true, leadId: true, googleEventId: true, googleCalendarId: true },
      take: limit,
      orderBy: { updatedAt: "asc" },
    }) as Promise<Array<{ id: string; leadId: string | null; googleEventId: string; googleCalendarId: string }>>;
  }

  async markRecoveryFailure(reservationId: string, error: string): Promise<void> {
    await prisma.teamMeetingSlotReservation.update({
      where: { id: reservationId },
      data: { recoveryAttempts: { increment: 1 }, lastRecoveryError: error.slice(0, 1_000) },
    });
  }

  async release(reservationId: string): Promise<void> {
    await prisma.teamMeetingSlotReservation.updateMany({
      where: {
        id: reservationId,
        state: TeamMeetingSlotReservationState.reserved,
        googleEventId: null,
      },
      data: { state: TeamMeetingSlotReservationState.released, releasedAt: new Date() },
    });
  }
}

export const teamMeetingSlotReservationRepository = new TeamMeetingSlotReservationRepository();
