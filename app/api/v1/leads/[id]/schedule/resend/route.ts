import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { InviteDispatchStatus, type Prisma } from "@prisma/client";
import { Output } from "@/lib/output";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { prisma } from "@/app/api/infra/data/prisma";
import { resendCalendarInvite } from "@/app/api/services/googleCalendar/GoogleCalendarService";
import { buildUniqueEmails, resolveParticipantDispatchGroups } from "@/app/api/services/leadSchedule/participantDispatch";
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

    const closerEmail = closerProfile.email.trim().toLowerCase();
    const participantDispatch = await resolveParticipantDispatchGroups({
      teamId: teamAccess.access.teamId,
      emails: [
        lead.email,
        closerEmail,
        lead.assignee?.email,
        ...(schedule.extraGuests ?? []),
      ],
    });
    const attendeeEmails = participantDispatch.all;

    const canUseGoogleCalendar = !!closerProfile.googleCalendarConnected && !!closerProfile.googleRefreshToken;
    const googleRecipients = canUseGoogleCalendar
      ? buildUniqueEmails([closerEmail, ...participantDispatch.googleEligible])
      : [];
    const googleRecipientSet = new Set(googleRecipients);
    const resendRecipients = canUseGoogleCalendar
      ? attendeeEmails.filter((item) => !googleRecipientSet.has(item))
      : attendeeEmails;
    const participantDispatchMetadata = {
      googleEligible: participantDispatch.googleEligible,
      resendRequired: participantDispatch.resendRequired,
      internalConnected: participantDispatch.internalConnected,
      internalDisconnected: participantDispatch.internalDisconnected,
      externalOrUnknown: participantDispatch.externalOrUnknown,
      googleRecipients,
      resendRecipients,
    };
    const inviteDispatchLastAttemptAt = new Date();
    let inviteDispatchStatus: InviteDispatchStatus = "failed";
    let inviteDispatchProvider: InviteDispatchProvider = "resend";
    const inviteDispatchFallbackUsed = false;
    let inviteDispatchLastError: string | null = null;
    let inviteDispatchLastPayload: Prisma.InputJsonValue | null = null;

    const successMessages: string[] = [];
    const errorMessages: string[] = [];

    if (target === "all") {
      let googleDispatchError: string | null = null;
      if (canUseGoogleCalendar) {
        if (!schedule.googleEventId) {
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
            recipients: googleRecipients,
            error: googleDispatchError,
            metadata: {
              provider: "google",
              reason: "google_event_not_found",
              ...participantDispatchMetadata,
            },
          });
          inviteDispatchStatus = "failed";
          inviteDispatchProvider = "google";
          inviteDispatchLastError = googleDispatchError;
          inviteDispatchLastPayload = {
            provider: "google",
            reason: "google_event_not_found",
            ...participantDispatchMetadata,
          };
          errorMessages.push(`Falha ao reenviar convite via Google Calendar: ${googleDispatchError}`);
        } else {
          try {
            await resendCalendarInvite({
              organizer: closerProfile,
              eventId: schedule.googleEventId,
              calendarId: schedule.googleCalendarId ?? "primary",
              attendeeEmails: googleRecipients,
            });

            inviteDispatchStatus = "sent_google";
            inviteDispatchProvider = "google";
            inviteDispatchLastError = null;
            inviteDispatchLastPayload = {
              provider: "google",
              eventId: schedule.googleEventId,
              calendarId: schedule.googleCalendarId ?? "primary",
              ...participantDispatchMetadata,
            };
            await registerInviteDispatchActivity({
              leadId,
              createdBy: teamAccess.access.profileId,
              provider: "google",
              status: "sent_google",
              fallbackUsed: false,
              attemptedAt: inviteDispatchLastAttemptAt,
              recipients: googleRecipients,
              error: null,
              metadata: inviteDispatchLastPayload,
            });
          } catch (googleError) {
            googleDispatchError = getErrorMessage(googleError, "Falha ao reenviar convite no Google Calendar");
            const googleCause = googleError instanceof Error ? googleError : new Error(googleDispatchError);
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
              googleCause
            );
            await registerInviteDispatchActivity({
              leadId,
              createdBy: teamAccess.access.profileId,
              provider: "google",
              status: "failed",
              fallbackUsed: false,
              attemptedAt: inviteDispatchLastAttemptAt,
              recipients: googleRecipients,
              error: googleDispatchError,
              metadata: {
                provider: "google",
                error: googleDispatchError,
                ...participantDispatchMetadata,
              },
            });
            inviteDispatchStatus = "failed";
            inviteDispatchProvider = "google";
            inviteDispatchLastError = googleDispatchError;
            inviteDispatchLastPayload = {
              provider: "google",
              error: googleDispatchError,
              ...participantDispatchMetadata,
            };
            errorMessages.push(`Falha ao reenviar convite via Google Calendar: ${googleDispatchError}`);
          }
        }
      } else {
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
            ...participantDispatchMetadata,
          },
        });
      }

      if ((!canUseGoogleCalendar || inviteDispatchStatus !== "failed") && resendRecipients.length > 0) {
        const organizerName = closerProfile.fullName || closerProfile.email;
        const emailResult = await emailService.sendMeetingInviteEmail({
          to: resendRecipients,
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
          if (!canUseGoogleCalendar) {
            inviteDispatchStatus = "sent_resend";
            inviteDispatchProvider = "resend";
          }
          inviteDispatchLastError = null;
          inviteDispatchLastPayload = {
            ...(inviteDispatchLastPayload && typeof inviteDispatchLastPayload === "object"
              ? inviteDispatchLastPayload
              : {}),
            resend: {
              resendMessageId,
              recipientCount: resendRecipients.length,
            },
            ...participantDispatchMetadata,
          };

          await registerInviteDispatchActivity({
            leadId,
            createdBy: teamAccess.access.profileId,
            provider: "resend",
            status: "sent_resend",
            fallbackUsed: false,
            attemptedAt: inviteDispatchLastAttemptAt,
            recipients: resendRecipients,
            error: null,
            metadata: inviteDispatchLastPayload,
          });
        } else {
          const resendError = emailResult.error || "Erro ao reenviar convite por e-mail";
          const resendCause = extractEmailErrorCause(emailResult) ?? new Error(resendError);
          logDispatchProviderError(
            {
              leadId,
              scheduleId: schedule.id,
              target: "all",
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
            recipientCount: resendRecipients.length,
            resendError,
            ...participantDispatchMetadata,
          };

          await registerInviteDispatchActivity({
            leadId,
            createdBy: teamAccess.access.profileId,
            provider: "resend",
            status: "failed",
            fallbackUsed: false,
            attemptedAt: inviteDispatchLastAttemptAt,
            recipients: resendRecipients,
            error: resendError,
            metadata: inviteDispatchLastPayload,
          });
          errorMessages.push(`Falha ao reenviar convite por e-mail para participantes sem Google: ${resendError}`);
        }
      }

      if (inviteDispatchStatus !== "failed") {
        successMessages.push("Convites reenviados para todos os participantes elegíveis");
        if (canUseGoogleCalendar && resendRecipients.length > 0) {
          successMessages.push(
            "Aviso: Participantes sem Google conectado receberam convite via e-mail (Resend)."
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
