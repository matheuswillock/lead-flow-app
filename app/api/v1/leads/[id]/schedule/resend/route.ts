import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { prisma } from "@/app/api/infra/data/prisma";
import { resendCalendarInvite } from "@/app/api/services/googleCalendar/GoogleCalendarService";
import { emailService } from "@/lib/services/EmailService";

const resendSchema = z.object({
  target: z.enum(["all", "single", "new"]),
  email: z.string().email().optional(),
  emails: z.array(z.string().email()).optional(),
});

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

    const body = await request.json();
    const validation = resendSchema.safeParse(body);
    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
        null
      );
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
        closer: true,
      },
    });

    if (!lead) {
      const output = new Output(false, [], ["Lead não encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    if (!lead.manager.googleCalendarConnected || !lead.manager.googleRefreshToken) {
      const output = new Output(false, [], ["Conecte seu Google Calendar para reenviar convites"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const { target, email } = validation.data;

    if (target === "all") {
      if (!schedule.googleEventId) {
        const output = new Output(false, [], ["Evento do Google Calendar não encontrado"], null);
        return NextResponse.json(output, { status: 400 });
      }

      await resendCalendarInvite({
        organizer: lead.manager,
        eventId: schedule.googleEventId,
        calendarId: schedule.googleCalendarId ?? "primary",
      });

      const output = new Output(true, ["Convites reenviados para todos os participantes"], [], null);
      return NextResponse.json(output, { status: 200 });
    }

    if (target === "new") {
      const emails = (validation.data.emails || []).map((item) => item.toLowerCase());
      const uniqueEmails = Array.from(new Set(emails));
      if (uniqueEmails.length === 0) {
        const output = new Output(false, [], ["Informe pelo menos um participante"], null);
        return NextResponse.json(output, { status: 400 });
      }

      const organizerName = lead.manager.fullName || lead.manager.email;

      const emailResult = await emailService.sendMeetingInviteEmail({
        to: uniqueEmails,
        leadName: lead.name,
        meetingTitle: schedule.meetingTitle || undefined,
        meetingDate: schedule.date,
        meetingLink: schedule.meetingLink,
        organizerName,
      });

      if (!emailResult.success) {
        const output = new Output(false, [], [emailResult.error || "Erro ao reenviar convite"], null);
        return NextResponse.json(output, { status: 500 });
      }

      const output = new Output(true, ["Convite reenviado para novos participantes"], [], null);
      return NextResponse.json(output, { status: 200 });
    }

    if (!email) {
      const output = new Output(false, [], ["Informe o email do participante"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const organizerName = lead.manager.fullName || lead.manager.email;
    const closerName = lead.closer?.fullName || lead.closer?.email || null;

    const emailResult = await emailService.sendMeetingInviteEmail({
      to: [email],
      leadName: lead.name,
      meetingTitle: schedule.meetingTitle || undefined,
      meetingDate: schedule.date,
      meetingLink: schedule.meetingLink,
      organizerName,
      closerName,
      notes: schedule.notes,
    });

    if (!emailResult.success) {
      const output = new Output(false, [], [emailResult.error || "Erro ao reenviar convite"], null);
      return NextResponse.json(output, { status: 500 });
    }

    const output = new Output(true, ["Convite reenviado para o participante"], [], null);
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("Erro ao reenviar convite:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
