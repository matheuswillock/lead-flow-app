import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { prisma } from "@/app/api/infra/data/prisma";
import { cancelCalendarEvent } from "@/app/api/services/googleCalendar/GoogleCalendarService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      const output = new Output(false, [], ["ID do usuário é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
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
      },
    });

    if (!lead) {
      const output = new Output(false, [], ["Lead não encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    let calendarWarning: string | null = null;
    const canUseGoogleCalendar = !!lead.manager.googleCalendarConnected && !!lead.manager.googleRefreshToken;
    if (schedule.googleEventId) {
      if (!canUseGoogleCalendar) {
        calendarWarning = "Conta Google não conectada. Evento não foi cancelado no Google Calendar.";
      } else {
        try {
          await cancelCalendarEvent({
            organizer: lead.manager,
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

    const successMessages = ["Agendamento cancelado com sucesso"];
    if (calendarWarning) {
      successMessages.push("Aviso: evento no Google Calendar não foi removido.");
    }
    const output = new Output(true, successMessages, [], null);
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("Erro ao cancelar agendamento:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
