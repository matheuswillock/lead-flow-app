import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { InviteDispatchStatus, type Prisma } from "@prisma/client";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { upsertCalendarEvent } from "@/app/api/services/googleCalendar/GoogleCalendarService";
import { emailService } from "@/lib/services/EmailService";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";
import { notificationService } from "@/app/api/services/notifications/NotificationService";

const scheduleSchema = z.object({
  date: z.string().datetime(),
  meetingTitle: z.string().optional(),
  notes: z.string().optional(),
  meetingLink: z.string().url("Link da reunião inválido").optional(),
  closerId: z.string().uuid("ID do closer deve ser um UUID válido").optional(),
  extraGuests: z.array(z.string().email("Email inválido")).optional(),
});

type InviteDispatchProvider = "google" | "resend";

type CalendarEventResult = {
  eventId: string;
  calendarId: string;
  htmlLink?: string | null;
  meetLink?: string | null;
};

type InviteDispatchPublicResult = {
  status: InviteDispatchStatus;
  provider: InviteDispatchProvider;
  fallbackUsed: boolean;
  attemptedAt: string;
  error: string | null;
};

type DispatchErrorLogContext = {
  leadId: string;
  scheduleId: string | null;
  target: "schedule";
  provider: InviteDispatchProvider;
  fallbackUsed: boolean;
  attemptedAt: Date;
  dispatchStatus: InviteDispatchStatus;
  errorMessage: string;
};

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

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const extractEmailErrorCause = (result: unknown): unknown => {
  if (!result || typeof result !== "object") return null;
  if (!("errorObject" in result)) return null;
  return (result as { errorObject?: unknown }).errorObject ?? null;
};

const logDispatchProviderError = (context: DispatchErrorLogContext, error: unknown) => {
  console.error(
    "[LeadScheduleRoute][POST] Falha no disparo de convite",
    {
      ...context,
      attemptedAt: context.attemptedAt.toISOString(),
    },
    error
  );
};

const logDispatchProviderSkipped = (
  context: Omit<DispatchErrorLogContext, "provider" | "errorMessage"> & { reason: string }
) => {
  console.warn("[LeadScheduleRoute][POST] Disparo via provider não executado", {
    ...context,
    attemptedAt: context.attemptedAt.toISOString(),
  });
};

const extractResendMessageId = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;
  const maybeId = (data as { id?: unknown }).id;
  return typeof maybeId === "string" ? maybeId : null;
};

const buildInviteDispatchBody = ({
  provider,
  status,
  fallbackUsed,
  error,
}: {
  provider: InviteDispatchProvider;
  status: InviteDispatchStatus;
  fallbackUsed: boolean;
  error: string | null;
}) => {
  if (status === "sent_google") {
    return "Convite de agendamento enviado via Google Calendar.";
  }
  if (status === "sent_resend" && fallbackUsed) {
    return "Convite enviado por e-mail (Resend) após falha no Google Calendar.";
  }
  if (status === "sent_resend") {
    return "Convite enviado por e-mail (Resend).";
  }
  if (provider === "google") {
    return error
      ? `Falha ao disparar convite via Google Calendar. Motivo: ${error}`
      : "Falha ao disparar convite via Google Calendar.";
  }
  if (fallbackUsed) {
    return error
      ? `Falha ao enviar convite por e-mail (Resend) após falha no Google Calendar. Motivo: ${error}`
      : "Falha ao enviar convite por e-mail (Resend) após falha no Google Calendar.";
  }
  return error
    ? `Falha ao enviar convite por e-mail (Resend). Motivo: ${error}`
    : "Falha ao enviar convite por e-mail (Resend).";
};

const registerInviteDispatchActivity = async ({
  leadId,
  createdBy,
  provider,
  status,
  fallbackUsed,
  attemptedAt,
  recipients,
  error,
  metadata,
}: {
  leadId: string;
  createdBy: string;
  provider: InviteDispatchProvider;
  status: InviteDispatchStatus;
  fallbackUsed: boolean;
  attemptedAt: Date;
  recipients: string[];
  error: string | null;
  metadata: Prisma.InputJsonValue | null;
}) => {
  try {
    await prisma.leadActivity.create({
      data: {
        leadId,
        type: "note",
        body: buildInviteDispatchBody({ provider, status, fallbackUsed, error }),
        payload: {
          kind: "schedule",
          action: "invite_dispatch",
          provider,
          status,
          fallbackUsed,
          attemptedAt: attemptedAt.toISOString(),
          recipients,
          error,
          metadata,
        },
        createdBy,
      },
    });
  } catch (activityError) {
    console.warn("[LeadScheduleRoute][POST] Não foi possível registrar atividade de disparo de convite:", activityError);
  }
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
        validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
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
    const attendeeEmails = buildUniqueEmails([
      lead.email,
      closerEmail,
      sdrEmail,
      ...(extraGuests ?? []),
    ]);

    const canUseGoogleCalendar = !!closerProfile.googleCalendarConnected && !!closerProfile.googleRefreshToken;
    let calendarResult: CalendarEventResult | null = null;
    let googleDispatchError: string | null = null;

    let inviteDispatchStatus: InviteDispatchStatus = "failed";
    let inviteDispatchProvider: InviteDispatchProvider = "resend";
    let inviteDispatchFallbackUsed = false;
    let inviteDispatchLastError: string | null = null;
    let inviteDispatchLastPayload: Prisma.InputJsonValue | null = null;
    const inviteDispatchLastAttemptAt = new Date();

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

        inviteDispatchStatus = "sent_google";
        inviteDispatchProvider = "google";
        inviteDispatchLastError = null;
        inviteDispatchLastPayload = {
          provider: "google",
          eventId: calendarResult.eventId,
          calendarId: calendarResult.calendarId,
          htmlLink: calendarResult.htmlLink ?? null,
          meetLink: calendarResult.meetLink ?? null,
        };

        await registerInviteDispatchActivity({
          leadId,
          createdBy: teamAccess.access.profileId,
          provider: "google",
          status: "sent_google",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: attendeeEmails,
          error: null,
          metadata: inviteDispatchLastPayload,
        });
      } catch (calendarError) {
        googleDispatchError = getErrorMessage(calendarError, "Falha ao criar evento no Google Calendar");
        logDispatchProviderError(
          {
            leadId,
            scheduleId: existingSchedule?.id ?? null,
            target: "schedule",
            provider: "google",
            fallbackUsed: false,
            attemptedAt: inviteDispatchLastAttemptAt,
            dispatchStatus: "failed",
            errorMessage: googleDispatchError,
          },
          calendarError
        );
        await registerInviteDispatchActivity({
          leadId,
          createdBy: teamAccess.access.profileId,
          provider: "google",
          status: "failed",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: attendeeEmails,
          error: googleDispatchError,
          metadata: {
            provider: "google",
            error: googleDispatchError,
          },
        });
      }
    } else {
      googleDispatchError = "Conta Google não conectada. Evento não foi criado no Google Calendar.";
      logDispatchProviderSkipped({
        leadId,
        scheduleId: existingSchedule?.id ?? null,
        target: "schedule",
        fallbackUsed: false,
        attemptedAt: inviteDispatchLastAttemptAt,
        dispatchStatus: "failed",
        reason: "google_not_connected",
      });
      await registerInviteDispatchActivity({
        leadId,
        createdBy: teamAccess.access.profileId,
        provider: "google",
        status: "failed",
        fallbackUsed: false,
        attemptedAt: inviteDispatchLastAttemptAt,
        recipients: attendeeEmails,
        error: googleDispatchError,
        metadata: {
          provider: "google",
          reason: "google_not_connected",
        },
      });
    }

    const resolvedMeetingLink = meetingLink || calendarResult?.meetLink || null;

    if (inviteDispatchStatus !== "sent_google") {
      const organizerName = closerProfile.fullName || closerProfile.email;
      const fallbackEventUid = existingSchedule?.id ?? `lead-${leadId}-${meetingDate.getTime()}`;
      const emailResult = await emailService.sendMeetingInviteEmail({
        to: attendeeEmails,
        leadName: lead.name,
        meetingTitle: resolvedMeetingTitle,
        meetingDate,
        meetingLink: resolvedMeetingLink,
        organizerName,
        organizerEmail: closerEmail,
        eventUid: fallbackEventUid,
      });

      if (emailResult.success) {
        const resendMessageId = extractResendMessageId(emailResult.data);
        inviteDispatchStatus = "sent_resend";
        inviteDispatchProvider = "resend";
        inviteDispatchFallbackUsed = canUseGoogleCalendar;
        inviteDispatchLastError = null;
        inviteDispatchLastPayload = {
          provider: "resend",
          resendMessageId,
          recipientCount: attendeeEmails.length,
          googleError: googleDispatchError,
        };

        await registerInviteDispatchActivity({
          leadId,
          createdBy: teamAccess.access.profileId,
          provider: "resend",
          status: "sent_resend",
          fallbackUsed: canUseGoogleCalendar,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: attendeeEmails,
          error: null,
          metadata: inviteDispatchLastPayload,
        });
      } else {
        const resendError = emailResult.error || "Convite por e-mail não pôde ser enviado.";
        const resendCause = extractEmailErrorCause(emailResult) ?? new Error(resendError);
        logDispatchProviderError(
          {
            leadId,
            scheduleId: existingSchedule?.id ?? null,
            target: "schedule",
            provider: "resend",
            fallbackUsed: canUseGoogleCalendar,
            attemptedAt: inviteDispatchLastAttemptAt,
            dispatchStatus: "failed",
            errorMessage: resendError,
          },
          resendCause
        );
        inviteDispatchStatus = "failed";
        inviteDispatchProvider = "resend";
        inviteDispatchFallbackUsed = canUseGoogleCalendar;
        inviteDispatchLastError = resendError;
        inviteDispatchLastPayload = {
          provider: "resend",
          recipientCount: attendeeEmails.length,
          googleError: googleDispatchError,
          resendError,
        };

        await registerInviteDispatchActivity({
          leadId,
          createdBy: teamAccess.access.profileId,
          provider: "resend",
          status: "failed",
          fallbackUsed: canUseGoogleCalendar,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: attendeeEmails,
          error: resendError,
          metadata: inviteDispatchLastPayload,
        });
      }
    }

    let schedule;
    let message: string;

    if (existingSchedule) {
      schedule = await leadScheduleRepository.update(existingSchedule.id, {
        date: meetingDate,
        meetingTitle: resolvedMeetingTitle,
        notes,
        meetingLink: resolvedMeetingLink || undefined,
        extraGuests: extraGuests ?? existingSchedule.extraGuests ?? [],
        googleEventId: calendarResult?.eventId ?? existingSchedule.googleEventId ?? undefined,
        googleCalendarId: calendarResult?.calendarId ?? existingSchedule.googleCalendarId ?? undefined,
        inviteDispatchStatus,
        inviteDispatchFallbackUsed,
        inviteDispatchLastAttemptAt,
        inviteDispatchLastError,
        inviteDispatchLastPayload,
      });
      message = "Agendamento atualizado com sucesso";
    } else {
      schedule = await leadScheduleRepository.create({
        leadId,
        date: meetingDate,
        meetingTitle: resolvedMeetingTitle,
        notes,
        meetingLink: resolvedMeetingLink || undefined,
        extraGuests,
        googleEventId: calendarResult?.eventId ?? undefined,
        googleCalendarId: calendarResult?.calendarId ?? undefined,
        inviteDispatchStatus,
        inviteDispatchFallbackUsed,
        inviteDispatchLastAttemptAt,
        inviteDispatchLastError,
        inviteDispatchLastPayload,
      });
      message = "Agendamento criado com sucesso";
    }

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

    let schedulerLabel = "Usuário";

    try {
      const schedulerProfile = await prisma.profile.findUnique({
        where: { id: teamAccess.access.profileId },
        select: { fullName: true, email: true },
      });
      schedulerLabel = schedulerProfile?.fullName || schedulerProfile?.email || "Usuário";
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
    } catch (activityError) {
      console.warn("[LeadScheduleRoute][POST] Não foi possível registrar atividade de agendamento:", activityError);
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
      } catch (activityError) {
        console.warn("[LeadScheduleRoute][POST] Não foi possível registrar atividade de alteração de closer:", activityError);
      }
    }

    try {
      const candidateRecipientProfileIds = Array.from(
        new Set(
          [lead.managerId, lead.assignedTo, resolvedCloserId]
            .filter((profileId): profileId is string => !!profileId)
            .filter((profileId) => profileId !== teamAccess.access.profileId)
        )
      );

      const teamRecipients = await prisma.teamMember.findMany({
        where: {
          teamId: teamAccess.access.teamId,
          profileId: { in: candidateRecipientProfileIds },
        },
        select: { profileId: true },
      });
      const recipientProfileIds = teamRecipients.map((member) => member.profileId);

      if (recipientProfileIds.length > 0) {
        await notificationService.createScheduleNotification({
          teamId: teamAccess.access.teamId,
          actorProfileId: teamAccess.access.profileId,
          actorName: schedulerLabel,
          leadId: lead.id,
          leadCode: lead.leadCode ?? null,
          leadName: lead.name,
          meetingDate,
          recipientProfileIds,
          isReschedule: !!existingSchedule,
        });
      }
    } catch (notificationError) {
      console.error("[LeadScheduleRoute][POST] Erro ao criar notificações de agendamento:", notificationError);
    }

    const successMessages = [message];

    if (inviteDispatchStatus === "sent_resend" && googleDispatchError) {
      successMessages.push(`Aviso: Google Calendar falhou (${googleDispatchError}). Convite enviado via e-mail (Resend).`);
    }

    if (inviteDispatchStatus === "failed") {
      const reason = inviteDispatchLastError || googleDispatchError || "Falha no envio do convite";
      successMessages.push(`Aviso: agendamento salvo, mas houve falha no envio do convite (${reason}).`);
    }

    const inviteDispatch: InviteDispatchPublicResult = {
      status: inviteDispatchStatus,
      provider: inviteDispatchProvider,
      fallbackUsed: inviteDispatchFallbackUsed,
      attemptedAt: inviteDispatchLastAttemptAt.toISOString(),
      error: inviteDispatchLastError,
    };

    const output = new Output(
      true,
      successMessages,
      [],
      {
        ...schedule,
        inviteDispatch,
      }
    );
    return NextResponse.json(output, { status: existingSchedule ? 200 : 201 });
  } catch (error) {
    console.error("[LeadScheduleRoute][POST] Erro ao criar agendamento:", error);
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

    const schedules = await leadScheduleRepository.findByLeadId(leadId);

    const output = new Output(true, [], [], schedules);
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("[LeadScheduleRoute][GET] Erro ao buscar agendamentos:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
