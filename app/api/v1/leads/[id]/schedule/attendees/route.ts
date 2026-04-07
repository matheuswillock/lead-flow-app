import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { prisma } from "@/app/api/infra/data/prisma";
import { getCalendarEventAttendees } from "@/app/api/services/googleCalendar/GoogleCalendarService";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";

export type AttendeeRole = "closer" | "sdr" | "lead" | "extra";

export type ScheduleAttendee = {
  email: string;
  displayName: string | null;
  role: AttendeeRole;
  responseStatus: "accepted" | "declined" | "tentative" | "needsAction";
};

/**
 * GET /api/v1/leads/[id]/schedule/attendees
 * Retorna a lista de participantes do agendamento mais recente do lead,
 * enriquecida com o status RSVP do Google Calendar (quando disponível)
 * e os papéis de cada participante (closer, sdr, lead, extra).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }
    if (!hasLeadAccess(teamAccess.access.teamMember)) {
      const output = new Output(false, [], ["Acesso negado: função SDR necessária para visualizar leads."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const { id: leadId } = await params;
    if (!leadId) {
      const output = new Output(false, [], ["ID do lead é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        teamId: true,
        email: true,
        closerId: true,
        assignedTo: true,
        closer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            googleCalendarConnected: true,
            googleRefreshToken: true,
            googleAccessToken: true,
            googleTokenExpiresAt: true,
          },
        },
        assignee: {
          select: { id: true, fullName: true, email: true },
        },
        manager: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!lead || lead.teamId !== teamAccess.access.teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    const schedule = await leadScheduleRepository.findLatestByLeadId(leadId);
    if (!schedule) {
      const output = new Output(true, [], [], []);
      return NextResponse.json(output, { status: 200 });
    }

    // Montar mapa de papéis para cruzamento posterior
    const roleMap = new Map<string, AttendeeRole>();

    const closerEmail = lead.closer?.email?.toLowerCase().trim();
    const sdrEmail = lead.assignee?.email?.toLowerCase().trim();
    const leadEmail = lead.email?.toLowerCase().trim();

    if (closerEmail) roleMap.set(closerEmail, "closer");
    // SDR pode ser o mesmo que o closer — só sobrescreve se for diferente
    if (sdrEmail && sdrEmail !== closerEmail) roleMap.set(sdrEmail, "sdr");
    if (leadEmail) roleMap.set(leadEmail, "lead");
    for (const guest of schedule.extraGuests ?? []) {
      const g = guest.toLowerCase().trim();
      if (!roleMap.has(g)) roleMap.set(g, "extra");
    }

    const canUseGoogle =
      !!schedule.googleEventId &&
      !!lead.closer?.googleCalendarConnected &&
      !!lead.closer?.googleRefreshToken;

    let attendees: ScheduleAttendee[];

    if (canUseGoogle) {
      // Buscar RSVP real do Google Calendar
      const googleAttendees = await getCalendarEventAttendees({
        organizer: lead.closer as Parameters<typeof getCalendarEventAttendees>[0]["organizer"],
        eventId: schedule.googleEventId!,
        calendarId: schedule.googleCalendarId ?? "primary",
      });

      attendees = googleAttendees.map((a) => ({
        email: a.email,
        displayName: a.displayName ?? null,
        role: roleMap.get(a.email.toLowerCase().trim()) ?? "extra",
        responseStatus: a.responseStatus,
      }));

      // Garantir que participantes do roleMap que não aparecem no Google estejam listados
      for (const [email, role] of roleMap.entries()) {
        if (!attendees.some((a) => a.email.toLowerCase().trim() === email)) {
          attendees.push({ email, displayName: null, role, responseStatus: "needsAction" });
        }
      }
    } else {
      // Sem Google Calendar: montar lista a partir do roleMap com status desconhecido
      attendees = Array.from(roleMap.entries()).map(([email, role]) => ({
        email,
        displayName: null,
        role,
        responseStatus: "needsAction" as const,
      }));
    }

    // Ordenar: closer → sdr → lead → extra
    const roleOrder: AttendeeRole[] = ["closer", "sdr", "lead", "extra"];
    attendees.sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));

    const output = new Output(true, [], [], {
      attendees,
      hasGoogleData: canUseGoogle,
      scheduleId: schedule.id,
    });
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("[ScheduleAttendeesRoute][GET /api/v1/leads/[id]/schedule/attendees] Erro inesperado:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
