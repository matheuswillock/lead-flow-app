import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { InviteDispatchStatus, type Prisma } from "@prisma/client";
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

type InviteDispatchProvider = "google" | "resend";

type InviteDispatchPublicResult = {
  status: InviteDispatchStatus;
  provider: InviteDispatchProvider;
  fallbackUsed: boolean;
  attemptedAt: string;
  error: string | null;
};

type ResendTarget = "all" | "single" | "new";

type DispatchErrorLogContext = {
  leadId: string;
  scheduleId: string | null;
  target: ResendTarget;
  provider: InviteDispatchProvider;
  fallbackUsed: boolean;
  attemptedAt: Date;
  dispatchStatus: InviteDispatchStatus;
  errorMessage: string;
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
    "[LeadScheduleResendRoute][POST] Falha no disparo de convite",
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
  console.warn("[LeadScheduleResendRoute][POST] Disparo via provider não executado", {
    ...context,
    attemptedAt: context.attemptedAt.toISOString(),
  });
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
    return "Reenvio de convite confirmado via Google Calendar.";
  }
  if (status === "sent_resend" && fallbackUsed) {
    return "Reenvio de convite enviado por e-mail (Resend) após falha no Google Calendar.";
  }
  if (status === "sent_resend") {
    return "Reenvio de convite enviado por e-mail (Resend).";
  }
  if (provider === "google") {
    return error
      ? `Falha ao reenviar convite via Google Calendar. Motivo: ${error}`
      : "Falha ao reenviar convite via Google Calendar.";
  }
  if (fallbackUsed) {
    return error
      ? `Falha ao reenviar convite por e-mail (Resend) após falha no Google Calendar. Motivo: ${error}`
      : "Falha ao reenviar convite por e-mail (Resend) após falha no Google Calendar.";
  }
  return error
    ? `Falha ao reenviar convite por e-mail (Resend). Motivo: ${error}`
    : "Falha ao reenviar convite por e-mail (Resend).";
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
          action: "invite_resend_dispatch",
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
    console.warn("[LeadScheduleResendRoute][POST] Não foi possível registrar atividade de reenvio:", activityError);
  }
};

const extractResendMessageId = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;
  const maybeId = (data as { id?: unknown }).id;
  return typeof maybeId === "string" ? maybeId : null;
};

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
        validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
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

    const attendeeEmails = buildUniqueEmails([
      lead.email,
      closerProfile.email,
      lead.assignee?.email,
      ...(schedule.extraGuests ?? []),
    ]);

    const canUseGoogleCalendar = !!closerProfile.googleCalendarConnected && !!closerProfile.googleRefreshToken;
    const inviteDispatchLastAttemptAt = new Date();
    let inviteDispatchStatus: InviteDispatchStatus = "failed";
    let inviteDispatchProvider: InviteDispatchProvider = "resend";
    let inviteDispatchFallbackUsed = false;
    let inviteDispatchLastError: string | null = null;
    let inviteDispatchLastPayload: Prisma.InputJsonValue | null = null;

    const successMessages: string[] = [];
    const errorMessages: string[] = [];

    if (target === "all") {
      let googleDispatchError: string | null = null;
      const canAttemptGoogle = canUseGoogleCalendar && !!schedule.googleEventId;

      if (canAttemptGoogle) {
        try {
          await resendCalendarInvite({
            organizer: closerProfile,
            eventId: schedule.googleEventId as string,
            calendarId: schedule.googleCalendarId ?? "primary",
            attendeeEmails,
          });

          inviteDispatchStatus = "sent_google";
          inviteDispatchProvider = "google";
          inviteDispatchLastPayload = {
            provider: "google",
            eventId: schedule.googleEventId,
            calendarId: schedule.googleCalendarId ?? "primary",
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
          successMessages.push("Convites reenviados para todos os participantes");
        } catch (googleError) {
          googleDispatchError = getErrorMessage(googleError, "Falha ao reenviar convite no Google Calendar");
          logDispatchProviderError(
            {
              leadId,
              scheduleId: schedule.id,
              target: "all",
              provider: "google",
              fallbackUsed: false,
              attemptedAt: inviteDispatchLastAttemptAt,
              dispatchStatus: "failed",
              errorMessage: googleDispatchError,
            },
            googleError
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
      } else if (!canUseGoogleCalendar) {
        googleDispatchError = "Conta Google não conectada para reenvio via Google Calendar.";
        logDispatchProviderSkipped({
          leadId,
          scheduleId: schedule.id,
          target: "all",
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
      } else {
        googleDispatchError = "Evento Google não encontrado para reenvio.";
        logDispatchProviderSkipped({
          leadId,
          scheduleId: schedule.id,
          target: "all",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          dispatchStatus: "failed",
          reason: "google_event_not_found",
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
            reason: "google_event_not_found",
          },
        });
      }

      if (inviteDispatchStatus !== "sent_google") {
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

        inviteDispatchFallbackUsed = canAttemptGoogle;
        if (emailResult.success) {
          const resendMessageId = extractResendMessageId(emailResult.data);
          inviteDispatchStatus = "sent_resend";
          inviteDispatchProvider = "resend";
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
            fallbackUsed: inviteDispatchFallbackUsed,
            attemptedAt: inviteDispatchLastAttemptAt,
            recipients: attendeeEmails,
            error: null,
            metadata: inviteDispatchLastPayload,
          });

          successMessages.push("Convites reenviados para todos os participantes");
          if (googleDispatchError) {
            successMessages.push(`Aviso: ${googleDispatchError} Convite reenviado via e-mail (Resend).`);
          }
        } else {
          const resendError = emailResult.error || "Erro ao reenviar convite por e-mail";
          const resendCause = extractEmailErrorCause(emailResult) ?? new Error(resendError);
          logDispatchProviderError(
            {
              leadId,
              scheduleId: schedule.id,
              target: "all",
              provider: "resend",
              fallbackUsed: inviteDispatchFallbackUsed,
              attemptedAt: inviteDispatchLastAttemptAt,
              dispatchStatus: "failed",
              errorMessage: resendError,
            },
            resendCause
          );
          inviteDispatchStatus = "failed";
          inviteDispatchProvider = "resend";
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
            fallbackUsed: inviteDispatchFallbackUsed,
            attemptedAt: inviteDispatchLastAttemptAt,
            recipients: attendeeEmails,
            error: resendError,
            metadata: inviteDispatchLastPayload,
          });
          errorMessages.push(
            googleDispatchError
              ? `Falha no Google Calendar (${googleDispatchError}) e no reenvio por e-mail (${resendError}).`
              : `Falha ao reenviar convite: ${resendError}`
          );
        }
      }
    }

    if (target === "new") {
      const emails = buildUniqueEmails(validation.data.emails || []);
      if (emails.length === 0) {
        const output = new Output(false, [], ["Informe pelo menos um participante"], null);
        return NextResponse.json(output, { status: 400 });
      }

      const organizerName = closerProfile.fullName || closerProfile.email;
      const emailResult = await emailService.sendMeetingInviteEmail({
        to: emails,
        leadName: lead.name,
        meetingTitle: schedule.meetingTitle || undefined,
        meetingDate: schedule.date,
        meetingLink: schedule.meetingLink,
        organizerName,
        organizerEmail: closerProfile.email,
        eventUid: schedule.id,
      });

      if (emailResult.success) {
        const resendMessageId = extractResendMessageId(emailResult.data);
        inviteDispatchStatus = "sent_resend";
        inviteDispatchProvider = "resend";
        inviteDispatchLastPayload = {
          provider: "resend",
          resendMessageId,
          recipientCount: emails.length,
          target: "new",
        };
        successMessages.push("Convite reenviado para novos participantes");
        await registerInviteDispatchActivity({
          leadId,
          createdBy: teamAccess.access.profileId,
          provider: "resend",
          status: "sent_resend",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: emails,
          error: null,
          metadata: inviteDispatchLastPayload,
        });
      } else {
        const resendError = emailResult.error || "Erro ao reenviar convite";
        const resendCause = extractEmailErrorCause(emailResult) ?? new Error(resendError);
        logDispatchProviderError(
          {
            leadId,
            scheduleId: schedule.id,
            target: "new",
            provider: "resend",
            fallbackUsed: false,
            attemptedAt: inviteDispatchLastAttemptAt,
            dispatchStatus: "failed",
            errorMessage: resendError,
          },
          resendCause
        );
        inviteDispatchStatus = "failed";
        inviteDispatchProvider = "resend";
        inviteDispatchLastError = resendError;
        inviteDispatchLastPayload = {
          provider: "resend",
          recipientCount: emails.length,
          target: "new",
          resendError,
        };
        errorMessages.push(resendError);
        await registerInviteDispatchActivity({
          leadId,
          createdBy: teamAccess.access.profileId,
          provider: "resend",
          status: "failed",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: emails,
          error: resendError,
          metadata: inviteDispatchLastPayload,
        });
      }
    }

    if (target === "single") {
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

      if (emailResult.success) {
        const resendMessageId = extractResendMessageId(emailResult.data);
        inviteDispatchStatus = "sent_resend";
        inviteDispatchProvider = "resend";
        inviteDispatchLastPayload = {
          provider: "resend",
          resendMessageId,
          recipientCount: 1,
          target: "single",
        };
        successMessages.push("Convite reenviado para o participante");
        await registerInviteDispatchActivity({
          leadId,
          createdBy: teamAccess.access.profileId,
          provider: "resend",
          status: "sent_resend",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: [email.toLowerCase()],
          error: null,
          metadata: inviteDispatchLastPayload,
        });
      } else {
        const resendError = emailResult.error || "Erro ao reenviar convite";
        const resendCause = extractEmailErrorCause(emailResult) ?? new Error(resendError);
        logDispatchProviderError(
          {
            leadId,
            scheduleId: schedule.id,
            target: "single",
            provider: "resend",
            fallbackUsed: false,
            attemptedAt: inviteDispatchLastAttemptAt,
            dispatchStatus: "failed",
            errorMessage: resendError,
          },
          resendCause
        );
        inviteDispatchStatus = "failed";
        inviteDispatchProvider = "resend";
        inviteDispatchLastError = resendError;
        inviteDispatchLastPayload = {
          provider: "resend",
          recipientCount: 1,
          target: "single",
          resendError,
        };
        errorMessages.push(resendError);
        await registerInviteDispatchActivity({
          leadId,
          createdBy: teamAccess.access.profileId,
          provider: "resend",
          status: "failed",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: [email.toLowerCase()],
          error: resendError,
          metadata: inviteDispatchLastPayload,
        });
      }
    }

    await leadScheduleRepository.update(schedule.id, {
      inviteDispatchStatus,
      inviteDispatchFallbackUsed,
      inviteDispatchLastAttemptAt,
      inviteDispatchLastError,
      inviteDispatchLastPayload,
    });

    const inviteDispatch: InviteDispatchPublicResult = {
      status: inviteDispatchStatus,
      provider: inviteDispatchProvider,
      fallbackUsed: inviteDispatchFallbackUsed,
      attemptedAt: inviteDispatchLastAttemptAt.toISOString(),
      error: inviteDispatchLastError,
    };

    if (inviteDispatchStatus === "failed") {
      const output = new Output(
        false,
        [],
        errorMessages.length > 0 ? errorMessages : ["Erro ao reenviar convite"],
        { inviteDispatch }
      );
      return NextResponse.json(output, { status: 500 });
    }

    const output = new Output(true, successMessages, [], { inviteDispatch });
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("[LeadScheduleResendRoute][POST] Erro ao reenviar convite:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
