import { Prisma, TeamMeetingSlotReservationState } from "@prisma/client";
import { prisma } from "../../prisma";
import type {
  CreateTeamMeetingSlotReservationInput,
  ITeamMeetingSlotReservationRepository,
  TeamMeetingSlotReservationResult,
  ValidTeamMeetingSlotReservation,
} from "./ITeamMeetingSlotReservationRepository";

export const MAX_RECOVERY_ATTEMPTS = 20;
export class ReservationConflictError extends Error {
  constructor(message = "A reserva não está mais disponível") {
    super(message);
    this.name = "ReservationConflictError";
  }
}

export class TeamMeetingSlotReservationRepository implements ITeamMeetingSlotReservationRepository {
  async isCloserEligibleForTeam(teamId: string, closerId: string): Promise<boolean> {
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId,
        profileId: closerId,
        functions: { has: "CLOSER" },
        team: { deletedAt: null },
        profile: { deletedAt: null },
      },
      select: { id: true },
    });
    return membership !== null;
  }

  async reserve(input: CreateTeamMeetingSlotReservationInput): Promise<TeamMeetingSlotReservationResult> {
    return prisma.$transaction(async (transaction) => {
      const eligibleCloser = await transaction.teamMember.findFirst({
        where: {
          teamId: input.teamId,
          profileId: input.closerId,
          functions: { has: "CLOSER" },
          team: { deletedAt: null },
          profile: { deletedAt: null },
        },
        select: { id: true },
      });
      if (!eligibleCloser) return { available: false };

      // Regra decidida em 21/09 (SPEC 13): o mesmo closer nunca tem duas reuniões
      // no mesmo horário, em QUALQUER time. Por isso a trava e a checagem de
      // conflito são por closer, não por time+closer.
      const lockKey = `closer:${input.closerId}`;
      await transaction.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

      const conflictingReservation = await transaction.teamMeetingSlotReservation.findFirst({
        where: {
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

  async consume(input: { reservationId: string; leadId?: string | null; googleEventId?: string | null; googleCalendarId?: string | null; teamId?: string; closerId?: string; startsAt?: Date; durationMinutes?: number }): Promise<void> {
    const updated = await prisma.teamMeetingSlotReservation.updateMany({
      where: {
        id: input.reservationId,
        state: TeamMeetingSlotReservationState.reserved,
        ...(input.teamId ? { teamId: input.teamId } : {}),
        ...(input.closerId ? { closerId: input.closerId } : {}),
        ...(input.startsAt ? { startsAt: input.startsAt } : {}),
        ...(input.durationMinutes != null ? { durationMinutes: input.durationMinutes } : {}),
      },
      data: {
        state: TeamMeetingSlotReservationState.consumed,
        consumedAt: new Date(),
        leadId: input.leadId ?? undefined,
        googleEventId: input.googleEventId ?? undefined,
        googleCalendarId: input.googleCalendarId ?? undefined,
      },
    });
    if (updated.count !== 1) throw new ReservationConflictError();
  }

  async validate(input: {
    reservationId: string;
    teamId?: string;
    closerId: string;
    leadId?: string | null;
    publicFormSubmissionId?: string | null;
    startsAt: Date;
    durationMinutes: number;
  }): Promise<boolean> {
    const reservation = await prisma.teamMeetingSlotReservation.findFirst({
      where: {
        id: input.reservationId,
        state: TeamMeetingSlotReservationState.reserved,
        ...(input.teamId ? { teamId: input.teamId } : {}),
        closerId: input.closerId,
        AND: [
          ...(input.leadId ? [{ OR: [{ leadId: null }, { leadId: input.leadId }] }] : []),
          ...(input.publicFormSubmissionId
            ? [{ OR: [{ publicFormSubmissionId: null }, { publicFormSubmissionId: input.publicFormSubmissionId }] }]
            : []),
        ],
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
      },
      select: { id: true },
    });
    return reservation !== null;
  }

  async findValid(input: {
    reservationId: string;
    teamId?: string;
    closerId: string;
    leadId?: string | null;
    publicFormSubmissionId?: string | null;
    startsAt: Date;
  }): Promise<ValidTeamMeetingSlotReservation | null> {
    return prisma.teamMeetingSlotReservation.findFirst({
      where: {
        id: input.reservationId,
        state: TeamMeetingSlotReservationState.reserved,
        ...(input.teamId ? { teamId: input.teamId } : {}),
        closerId: input.closerId,
        ...(input.leadId
          ? { OR: [{ leadId: null }, { leadId: input.leadId }] }
          : {}),
        ...(input.publicFormSubmissionId
          ? { publicFormSubmissionId: input.publicFormSubmissionId }
          : {}),
        startsAt: input.startsAt,
      },
      select: {
        id: true,
        teamId: true,
        closerId: true,
        leadId: true,
        publicFormSubmissionId: true,
        startsAt: true,
        endsAt: true,
        durationMinutes: true,
      },
    });
  }

  async attachToPublicFormSubmission(input: { reservationId: string; publicFormSubmissionId: string }): Promise<void> {
    const updated = await prisma.teamMeetingSlotReservation.updateMany({
      where: { id: input.reservationId, state: TeamMeetingSlotReservationState.reserved, publicFormSubmissionId: null },
      data: { publicFormSubmissionId: input.publicFormSubmissionId },
    });
    if (updated.count !== 1) throw new ReservationConflictError();
  }

  async attachToLead(input: { reservationId: string; leadId: string }): Promise<void> {
    const updated = await prisma.teamMeetingSlotReservation.updateMany({
      where: { id: input.reservationId, state: TeamMeetingSlotReservationState.reserved, leadId: null },
      data: { leadId: input.leadId },
    });
    if (updated.count !== 1) throw new ReservationConflictError();
  }

  async markExternalEvent(input: { reservationId: string; googleEventId: string; googleCalendarId: string }): Promise<void> {
    const updated = await prisma.teamMeetingSlotReservation.updateMany({
      where: { id: input.reservationId, state: TeamMeetingSlotReservationState.reserved },
      data: { googleEventId: input.googleEventId, googleCalendarId: input.googleCalendarId },
    });
    if (updated.count !== 1) throw new ReservationConflictError();
  }

  async findRecoverable(limit: number) {
    return prisma.teamMeetingSlotReservation.findMany({
      where: {
        state: TeamMeetingSlotReservationState.reserved,
        googleEventId: { not: null },
        googleCalendarId: { not: null },
        recoveryAttempts: { lt: MAX_RECOVERY_ATTEMPTS },
      },
      select: {
        id: true,
        leadId: true,
        closerId: true,
        googleEventId: true,
        googleCalendarId: true,
        recoveryAttempts: true,
      },
      take: limit,
      orderBy: { updatedAt: "asc" },
    }) as Promise<Array<{
      id: string;
      leadId: string | null;
      closerId: string;
      googleEventId: string;
      googleCalendarId: string;
      recoveryAttempts: number;
    }>>;
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

  async releaseAfterRecoveryTimeout(reservationId: string): Promise<void> {
    await prisma.teamMeetingSlotReservation.updateMany({
      where: {
        id: reservationId,
        state: TeamMeetingSlotReservationState.reserved,
        googleEventId: { not: null },
        recoveryAttempts: { gte: MAX_RECOVERY_ATTEMPTS - 1 },
      },
      data: { state: TeamMeetingSlotReservationState.released, releasedAt: new Date() },
    });
  }

  async releaseConsumedForLead(input: { leadId: string; exceptReservationId?: string }): Promise<void> {
    await prisma.teamMeetingSlotReservation.updateMany({
      where: {
        leadId: input.leadId,
        state: TeamMeetingSlotReservationState.consumed,
        ...(input.exceptReservationId ? { id: { not: input.exceptReservationId } } : {}),
      },
      data: { state: TeamMeetingSlotReservationState.released, releasedAt: new Date() },
    });
  }
}

export const teamMeetingSlotReservationRepository = new TeamMeetingSlotReservationRepository();
