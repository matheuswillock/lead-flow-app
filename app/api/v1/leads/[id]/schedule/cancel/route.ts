import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { prisma } from "@/app/api/infra/data/prisma";
import { cancelCalendarEvent } from "@/app/api/services/googleCalendar/GoogleCalendarService";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";
import { isGoogleConnectionActive } from "@/lib/google/connection";
import { invalidateTeamCalendarCache } from "@/lib/cache/invalidation";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function POST(
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

    const schedule = await leadScheduleRepository.findLatestByLeadId(leadId);
    if (!schedule) {
      const output = new Output(false, [], ["Agendamento não encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        manager: true,
        closer: {
          include: {
            googleConnection: true,
          },
        },
      },
    });

    if (!lead || lead.teamId !== teamAccess.access.teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    let calendarWarning: string | null = null;
    const closerProfile = lead.closer;
    const canUseGoogleCalendar = !!closerProfile && isGoogleConnectionActive(closerProfile.googleConnection);
    if (schedule.googleEventId) {
      if (!closerProfile || !canUseGoogleCalendar) {
        calendarWarning = "Conta Google não conectada. Evento não foi cancelado no Google Calendar.";
      } else {
        try {
          await cancelCalendarEvent({
            organizer: closerProfile,
            eventId: schedule.googleEventId,
            calendarId: schedule.googleCalendarId ?? "primary",
          });
        } catch (calendarError) {
          console.warn("Erro ao cancelar evento no Google Calendar:", calendarError);
          calendarWarning = calendarError instanceof Error
            ? calendarError.message
            : "Falha ao cancelar evento no Google Calendar";
        }
      }
    }

    await leadScheduleRepository.delete(schedule.id);

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        meetingDate: null,
        meetingTitle: null,
        meetingNotes: null,
        meetingLink: null,
        meetingHeald: null,
        status: lead.status === "scheduled" ? "new_opportunity" : lead.status,
      },
    });

    try {
      await prisma.leadActivity.create({
        data: {
          leadId,
          type: "note",
          body: "Agendamento cancelado",
          createdBy: teamAccess.access.profileId,
        },
      });
    } catch (error) {
    rethrowIfPrerenderInterrupted(error);
      console.warn("Não foi possível registrar atividade de cancelamento:", error);
    }

    const successMessages = ["Agendamento cancelado com sucesso"];
    if (calendarWarning) {
      successMessages.push("Aviso: evento no Google Calendar não foi removido.");
    }
    const output = new Output(true, successMessages, [], null);
    invalidateTeamCalendarCache({ teamId: teamAccess.access.teamId, leadId });
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Erro ao cancelar agendamento:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
