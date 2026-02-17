import { NextRequest, NextResponse } from "next/server";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { z } from "zod";
import { upsertCalendarEvent } from "@/app/api/services/googleCalendar/GoogleCalendarService";
import { emailService } from "@/lib/services/EmailService";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";

const scheduleSchema = z.object({
  date: z.string().datetime(),
  meetingTitle: z.string().optional(),
  notes: z.string().optional(),
  meetingLink: z.string().url("Link da reunião inválido").optional(),
  closerId: z.string().uuid("ID do closer deve ser um UUID válido").optional(),
  extraGuests: z.array(z.string().email("Email inválido")).optional(),
});

const formatMeetingDate = (date: Date) =>
  date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const buildUniqueEmails = (emails: Array<string | null | undefined>) => {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const email of emails) {
    if (!email) continue;
    const normalized = email.trim().toLowerCase();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
};

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

    const body = await request.json();
    const validation = scheduleSchema.safeParse(body);

    if (!validation.success) {
      const output = new Output(
        false, 
        [], 
        validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    const { id: leadId } = await params;

    if (!leadId) {
      const output = new Output(false, [], ["ID do lead é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const { date, meetingTitle, notes, meetingLink, closerId, extraGuests } = validation.data;
    const meetingDate = new Date(date);

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

    const previousCloserId = lead.closerId ?? null;
    const shouldLogCloserChange = !!closerId && closerId !== previousCloserId;

    // Verificar se já existe um agendamento para este lead
    const existingSchedule = await leadScheduleRepository.findLatestByLeadId(leadId);

    const resolvedCloserId = closerId || lead.closerId;
    if (!resolvedCloserId) {
      const output = new Output(false, [], ["Selecione um closer para a reunião."], null);
      return NextResponse.json(output, { status: 400 });
    }

    const closerProfile = await prisma.profile.findUnique({
      where: { id: resolvedCloserId },
    });

    if (!closerProfile || !closerProfile.email) {
      const output = new Output(false, [], ["Closer não encontrado ou sem e-mail válido."], null);
      return NextResponse.json(output, { status: 400 });
    }

    const closerEmail = closerProfile.email;
    const sdrEmail = lead.assignee?.email || null;
    const resolvedMeetingTitle = meetingTitle || `Estudo Plano de Saúde: ${lead.name}`;

    const canUseGoogleCalendar = !!closerProfile.googleCalendarConnected && !!closerProfile.googleRefreshToken;
    let calendarResult: { eventId: string; calendarId: string; meetLink?: string | null } | null = null;
    let calendarWarning: string | null = null;

    if (canUseGoogleCalendar) {
      try {
        calendarResult = await upsertCalendarEvent({
          organizer: closerProfile,
          lead,
          closerEmail,
          sdrEmail,
          meetingDate,
          meetingTitle: resolvedMeetingTitle,
          notes,
          meetingLink,
          extraGuests,
          existingEventId: existingSchedule?.googleEventId ?? null,
        });
      } catch (calendarError) {
        console.warn("Erro ao criar evento no Google Calendar:", calendarError);
        calendarWarning = calendarError instanceof Error
          ? calendarError.message
          : "Falha ao criar evento no Google Calendar";
      }
    } else {
      calendarWarning = "Conta Google não conectada. Evento não foi criado no Google Calendar.";
    }

    const resolvedMeetingLink = meetingLink || calendarResult?.meetLink || null;

    let schedule;
    let message: string;

    if (existingSchedule) {
      // Atualizar o agendamento existente
      schedule = await leadScheduleRepository.update(existingSchedule.id, {
        date: meetingDate,
        meetingTitle: resolvedMeetingTitle,
        notes,
        meetingLink: resolvedMeetingLink || undefined,
        extraGuests: extraGuests ?? existingSchedule.extraGuests ?? [],
        googleEventId: calendarResult?.eventId,
        googleCalendarId: calendarResult?.calendarId,
      });
      message = "Agendamento atualizado com sucesso";
    } else {
      // Criar novo agendamento
      schedule = await leadScheduleRepository.create({
        leadId,
        date: meetingDate,
        meetingTitle: resolvedMeetingTitle,
        notes,
        meetingLink: resolvedMeetingLink || undefined,
        extraGuests,
        googleEventId: calendarResult?.eventId,
        googleCalendarId: calendarResult?.calendarId,
      });
      message = "Agendamento criado com sucesso";
    }

    if (!canUseGoogleCalendar) {
      const attendeeEmails = [
        lead.email,
        closerEmail,
        sdrEmail,
        ...(extraGuests ?? []),
      ]
        .filter(Boolean)
        .map((email) => (email as string).trim().toLowerCase())
        .filter((email, index, list) => list.indexOf(email) === index);

      if (attendeeEmails.length > 0) {
        const organizerName = closerProfile.fullName || closerProfile.email;
        const emailResult = await emailService.sendMeetingInviteEmail({
          to: attendeeEmails,
          leadName: lead.name,
          meetingTitle: resolvedMeetingTitle,
          meetingDate,
          meetingLink: resolvedMeetingLink,
          organizerName,
        });
        if (!emailResult.success) {
          console.warn("Erro ao enviar convites por e-mail:", emailResult.error);
          if (!calendarWarning) {
            calendarWarning = "Convite por e-mail não pôde ser enviado.";
          }
        }
      }
    }

    // Atualizar o campo meetingDate do lead
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        meetingDate,
        meetingTitle: resolvedMeetingTitle,
        meetingNotes: notes || null,
        meetingLink: resolvedMeetingLink || null,
        ...(closerId ? { closerId } : {}),
      },
    });

    try {
      const schedulerProfile = await prisma.profile.findUnique({
        where: { id: teamAccess.access.profileId },
        select: { fullName: true, email: true },
      });
      const schedulerLabel = schedulerProfile?.fullName || schedulerProfile?.email || "Usuário";
      const actionLabel = existingSchedule ? "Reagendamento feito por" : "Agendamento feito por";

      const participants = buildUniqueEmails([
        lead.email,
        closerProfile.email,
        lead.assignee?.email,
        ...(extraGuests ?? []),
      ]);
      const participantLines = participants.map((email) => `• ${email}`);

      const bodyLines = [
        `${actionLabel} ${schedulerLabel} para ${formatMeetingDate(meetingDate)}.`,
      ];
      if (participantLines.length > 0) {
        bodyLines.push("Participantes:", ...participantLines);
      }

      await prisma.leadActivity.create({
        data: {
          leadId,
          type: "note",
          body: bodyLines.join("\n"),
          payload: {
            kind: "schedule",
            meetingDate: meetingDate.toISOString(),
            meetingTitle: resolvedMeetingTitle,
            participants,
          },
          createdBy: teamAccess.access.profileId,
        },
      });
    } catch (error) {
      console.warn("Não foi possível registrar atividade de agendamento:", error);
    }

    if (shouldLogCloserChange) {
      try {
        const newCloserId = closerId as string;
        const closerLabel = closerProfile.fullName || closerProfile.email || "Closer";
        await prisma.leadActivity.create({
          data: {
            leadId,
            type: "note",
            body: `Closer alterado para ${closerLabel}`,
            payload: {
              previousCloserId,
              closerId: newCloserId,
            },
            createdBy: teamAccess.access.profileId,
          },
        });
      } catch (error) {
        console.warn("Não foi possível registrar atividade de alteração de closer:", error);
      }
    }

    const successMessages = [message];
    if (calendarWarning) {
      successMessages.push(`Aviso: ${calendarWarning}`);
    }
    const output = new Output(true, successMessages, [], schedule);
    return NextResponse.json(output, { status: existingSchedule ? 200 : 201 });

  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

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
      select: { id: true, teamId: true },
    });

    if (!lead || lead.teamId !== teamAccess.access.teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    // Buscar agendamentos do lead
    const schedules = await leadScheduleRepository.findByLeadId(leadId);

    const output = new Output(true, [], [], schedules);
    return NextResponse.json(output, { status: 200 });

  } catch (error) {
    console.error("Erro ao buscar agendamentos:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
