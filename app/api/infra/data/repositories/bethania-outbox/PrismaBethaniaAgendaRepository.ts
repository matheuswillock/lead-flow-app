import { LeadStatus } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { enqueueBethaniaOutboxInTransaction } from "@/app/api/infra/data/repositories/bethania-outbox/EnqueueBethaniaOutboxTransaction";
import type { BethaniaAgendaRepository, AgendaWindow, BethaniaOutboxEnqueueInput } from "@/app/api/useCases/bethania-outbox/BethaniaOutboxPorts";

export class PrismaBethaniaAgendaRepository implements BethaniaAgendaRepository {
  async findVerifiedProfiles() {
    return prisma.profile.findMany({
      where: { whatsappPhone: { not: null }, whatsappPhoneVerifiedAt: { not: null } },
      select: { id: true, supabaseId: true, timezone: true },
    });
  }

  async findAppointments(profileId: string, window: AgendaWindow) {
    const rows = await prisma.leadsSchedule.findMany({
      where: {
        date: { gte: window.from, lte: window.to },
        lead: { is: { closerId: profileId, status: LeadStatus.scheduled } },
      },
      select: {
        id: true,
        leadId: true,
        date: true,
        meetingDurationMinutes: true,
        lead: { select: { leadCode: true, name: true, meetingHeald: true, status: true } },
      },
      orderBy: { date: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      leadId: row.leadId,
      leadCode: row.lead.leadCode,
      leadName: row.lead.name,
      date: row.date,
      durationMinutes: row.meetingDurationMinutes,
      meetingHeald: row.lead.meetingHeald,
      status: row.lead.status,
    }));
  }

  enqueue(input: BethaniaOutboxEnqueueInput) {
    return prisma.$transaction((tx) => enqueueBethaniaOutboxInTransaction(tx, input));
  }
}

export const bethaniaAgendaRepository = new PrismaBethaniaAgendaRepository();
