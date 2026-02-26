import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { prisma } from "@/app/api/infra/data/prisma";
import { resendCalendarInvite } from "@/app/api/services/googleCalendar/GoogleCalendarService";
import { emailService } from "@/lib/services/EmailService";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";

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
        assignee: true,
      },
    });

    if (!lead || lead.teamId !== teamAccess.access.teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    const { target, email } = validation.data;
    const closerProfile = lead.closer;
    if (!closerProfile || !closerProfile.email) {
      const output = new Output(false, [], ["Closer não encontrado ou sem e-mail válido."], null);
      return NextResponse.json(output, { status: 400 });
    }

    const attendeeEmails = [
      lead.email,
      closerProfile.email,
      lead.assignee?.email,
      ...(schedule.extraGuests ?? []),
    ]
      .filter(Boolean)
      .map((item) => (item as string).trim().toLowerCase())
      .filter((value, index, list) => list.indexOf(value) === index);

    const canUseGoogleCalendar = !!closerProfile.googleCalendarConnected && !!closerProfile.googleRefreshToken;

    if (target === "all") {
      if (canUseGoogleCalendar && schedule.googleEventId) {
        await resendCalendarInvite({
          organizer: closerProfile,
          eventId: schedule.googleEventId,
          calendarId: schedule.googleCalendarId ?? "primary",
          attendeeEmails,
        });
      } else {
        const organizerName = closerProfile.fullName || closerProfile.email;
        const emailResult = await emailService.sendMeetingInviteEmail({
          to: attendeeEmails,
          leadName: lead.name,
          meetingTitle: schedule.meetingTitle || undefined,
          meetingDate: schedule.date,
          meetingLink: schedule.meetingLink,
          organizerName,
          organizerEmail: closerProfile.email,
          eventUid: schedule.id,
        });

        if (!emailResult.success) {
          const output = new Output(false, [], [emailResult.error || "Erro ao reenviar convite"], null);
          return NextResponse.json(output, { status: 500 });
        }
      }

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

      const organizerName = closerProfile.fullName || closerProfile.email;

      const emailResult = await emailService.sendMeetingInviteEmail({
        to: uniqueEmails,
        leadName: lead.name,
        meetingTitle: schedule.meetingTitle || undefined,
        meetingDate: schedule.date,
        meetingLink: schedule.meetingLink,
        organizerName,
        organizerEmail: closerProfile.email,
        eventUid: schedule.id,
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

    const organizerName = closerProfile.fullName || closerProfile.email;
    const closerName = closerProfile.fullName || closerProfile.email || null;

    const emailResult = await emailService.sendMeetingInviteEmail({
      to: [email],
      leadName: lead.name,
      meetingTitle: schedule.meetingTitle || undefined,
      meetingDate: schedule.date,
      meetingLink: schedule.meetingLink,
      organizerName,
      closerName,
      organizerEmail: closerProfile.email,
      eventUid: schedule.id,
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
