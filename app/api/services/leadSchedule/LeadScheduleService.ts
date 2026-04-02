import { randomUUID } from "node:crypto";
import { ActivityType, InviteDispatchStatus, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { upsertCalendarEvent } from "@/app/api/services/googleCalendar/GoogleCalendarService";
import { emailService } from "@/lib/services/EmailService";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { Output } from "@/lib/output";
import type { ILeadScheduleService, CreateScheduleParams } from "./ILeadScheduleService";

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

const STATUS_LABELS: Record<LeadStatus, string> = {
  new_opportunity: "Nova oportunidade",
  scheduled: "Agendado",
  no_show: "No Show",
  pricingRequest: "Cotação",
  offerNegotiation: "Negociação",
  pending_documents: "Documentos pendentes",
  offerSubmission: "Proposta",
  dps_agreement: "DPS | Contrato",
  invoicePayment: "Boleto",
  disqualified: "Desqualificado",
  opportunityLost: "Perdido",
  operator_denied: "Negado operadora",
  contract_finalized: "Negócio fechado",
};

const LOG_PREFIX = "[LeadScheduleService]";

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
    console.warn(`${LOG_PREFIX} Não foi possível registrar atividade de disparo de convite:`, activityError);
  }
};

export class LeadScheduleService implements ILeadScheduleService {
  async createSchedule(params: CreateScheduleParams): Promise<Output> {
    const {
      leadId,
      leadName,
      leadEmail,
      leadStatus,
      leadManagerId,
      leadAssignedTo,
      leadAssigneeEmail,
      leadCurrentCloserId,
      leadCode,
      closerId,
      teamId,
      meetingDate: meetingDateISO,
      meetingTitle,
      meetingNotes,
      meetingLink,
      extraGuests,
      createdByProfileId,
      transitionStatusToScheduled,
    } = params;

    const meetingDate = new Date(meetingDateISO);
    const shouldLogCloserChange = closerId !== leadCurrentCloserId;

    const existingSchedule = await leadScheduleRepository.findLatestByLeadId(leadId);
    const scheduleId = existingSchedule?.id ?? randomUUID();

    const closerProfile = await prisma.profile.findUnique({
      where: { id: closerId },
    });

    if (!closerProfile || !closerProfile.email) {
      return new Output(false, [], ["Closer não encontrado ou sem e-mail válido."], null);
    }

    const closerEmail = closerProfile.email;
    const resolvedMeetingTitle = meetingTitle || `Estudo Plano de Saúde: ${leadName}`;
    const attendeeEmails = buildUniqueEmails([
      leadEmail,
      closerEmail,
      leadAssigneeEmail,
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

    // --- Google Calendar attempt ---
    if (canUseGoogleCalendar) {
      try {
        calendarResult = await upsertCalendarEvent({
          organizer: closerProfile,
          lead: { id: leadId, name: leadName, email: leadEmail } as any,
          closerEmail,
          sdrEmail: leadAssigneeEmail,
          meetingDate,
          meetingTitle: resolvedMeetingTitle,
          notes: meetingNotes,
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
          createdBy: createdByProfileId,
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
        console.error(`${LOG_PREFIX} Falha no disparo de convite via Google Calendar`, {
          leadId,
          scheduleId,
          errorMessage: googleDispatchError,
        }, calendarError);
        await registerInviteDispatchActivity({
          leadId,
          createdBy: createdByProfileId,
          provider: "google",
          status: "failed",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: attendeeEmails,
          error: googleDispatchError,
          metadata: { provider: "google", error: googleDispatchError },
        });
      }
    } else {
      googleDispatchError = "Conta Google não conectada. Evento não foi criado no Google Calendar.";
      console.warn(`${LOG_PREFIX} Google Calendar não conectado para closer`, { leadId, closerId });
      await registerInviteDispatchActivity({
        leadId,
        createdBy: createdByProfileId,
        provider: "google",
        status: "failed",
        fallbackUsed: false,
        attemptedAt: inviteDispatchLastAttemptAt,
        recipients: attendeeEmails,
        error: googleDispatchError,
        metadata: { provider: "google", reason: "google_not_connected" },
      });
    }

    const resolvedMeetingLink = meetingLink || calendarResult?.meetLink || null;

    if (!resolvedMeetingLink?.trim()) {
      return new Output(
        false,
        [],
        ["Não foi possível concluir o agendamento sem um link válido da reunião."],
        null
      );
    }

    // --- Resend email fallback ---
    if (inviteDispatchStatus !== "sent_google") {
      const organizerName = closerProfile.fullName || closerProfile.email;
      const emailResult = await emailService.sendMeetingInviteEmail({
        to: attendeeEmails,
        leadName,
        meetingTitle: resolvedMeetingTitle,
        meetingDate,
        meetingLink: resolvedMeetingLink,
        organizerName,
        organizerEmail: closerEmail,
        eventUid: scheduleId,
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
          createdBy: createdByProfileId,
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
        console.error(`${LOG_PREFIX} Falha no disparo de convite via Resend`, {
          leadId,
          scheduleId,
          errorMessage: resendError,
        });
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
          createdBy: createdByProfileId,
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

    if (inviteDispatchStatus === "failed") {
      const reason = inviteDispatchLastError || googleDispatchError || "Falha no envio do convite";
      return new Output(
        false,
        [],
        [`Não foi possível concluir o agendamento porque o convite não foi enviado com sucesso (${reason}).`],
        null
      );
    }

    // --- Persist schedule + update lead ---
    const persisted = await prisma.$transaction(async (tx) => {
      const inviteDispatchLastPayloadForDb =
        inviteDispatchLastPayload === null ? Prisma.JsonNull : (inviteDispatchLastPayload ?? undefined);

      const schedule = existingSchedule
        ? await tx.leadsSchedule.update({
            where: { id: existingSchedule.id },
            data: {
              date: meetingDate,
              meetingTitle: resolvedMeetingTitle,
              notes: meetingNotes,
              meetingLink: resolvedMeetingLink,
              extraGuests: extraGuests ?? existingSchedule.extraGuests ?? [],
              googleEventId: calendarResult?.eventId ?? existingSchedule.googleEventId ?? undefined,
              googleCalendarId: calendarResult?.calendarId ?? existingSchedule.googleCalendarId ?? undefined,
              inviteDispatchStatus,
              inviteDispatchFallbackUsed,
              inviteDispatchLastAttemptAt,
              inviteDispatchLastError,
              inviteDispatchLastPayload: inviteDispatchLastPayloadForDb,
            },
          })
        : await tx.leadsSchedule.create({
            data: {
              id: scheduleId,
              leadId,
              date: meetingDate,
              meetingTitle: resolvedMeetingTitle,
              notes: meetingNotes,
              meetingLink: resolvedMeetingLink,
              extraGuests: extraGuests ?? [],
              googleEventId: calendarResult?.eventId ?? undefined,
              googleCalendarId: calendarResult?.calendarId ?? undefined,
              inviteDispatchStatus,
              inviteDispatchFallbackUsed,
              inviteDispatchLastAttemptAt,
              inviteDispatchLastError,
              inviteDispatchLastPayload: inviteDispatchLastPayloadForDb,
            },
          });

      const updatedLead = await tx.lead.update({
        where: { id: leadId },
        data: {
          meetingDate,
          meetingTitle: resolvedMeetingTitle,
          meetingNotes: meetingNotes || null,
          meetingLink: resolvedMeetingLink,
          closerId,
          ...(transitionStatusToScheduled === true ? { status: LeadStatus.scheduled } : {}),
        },
      });

      if (transitionStatusToScheduled === true && leadStatus !== LeadStatus.scheduled) {
        const fromStatus = leadStatus as LeadStatus;
        const fromLabel = STATUS_LABELS[fromStatus] ?? fromStatus;
        const toLabel = STATUS_LABELS[LeadStatus.scheduled];

        await tx.leadActivity.create({
          data: {
            leadId,
            type: ActivityType.status_change,
            body: `Status alterado de ${fromLabel} para ${toLabel}`,
            payload: {
              from: fromStatus,
              to: LeadStatus.scheduled,
              fromLabel,
              toLabel,
            },
            createdBy: createdByProfileId,
          },
        });
      }

      return {
        schedule,
        lead: updatedLead,
        message: existingSchedule ? "Agendamento atualizado com sucesso" : "Agendamento criado com sucesso",
      };
    });

    // --- Activity log for schedule creation ---
    let schedulerLabel = "Usuário";
    try {
      const schedulerProfile = await prisma.profile.findUnique({
        where: { id: createdByProfileId },
        select: { fullName: true, email: true },
      });
      schedulerLabel = schedulerProfile?.fullName || schedulerProfile?.email || "Usuário";
      const actionLabel = existingSchedule ? "Reagendamento feito por" : "Agendamento feito por";

      const participants = buildUniqueEmails([
        leadEmail,
        closerProfile.email,
        leadAssigneeEmail,
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
          createdBy: createdByProfileId,
        },
      });
    } catch (activityError) {
      console.warn(`${LOG_PREFIX} Não foi possível registrar atividade de agendamento:`, activityError);
    }

    // --- Closer change activity ---
    if (shouldLogCloserChange) {
      try {
        const closerLabel = closerProfile.fullName || closerProfile.email || "Closer";
        await prisma.leadActivity.create({
          data: {
            leadId,
            type: "note",
            body: `Closer alterado para ${closerLabel}`,
            payload: {
              previousCloserId: leadCurrentCloserId,
              closerId,
            },
            createdBy: createdByProfileId,
          },
        });
      } catch (activityError) {
        console.warn(`${LOG_PREFIX} Não foi possível registrar atividade de alteração de closer:`, activityError);
      }
    }

    // --- Notifications ---
    try {
      const candidateRecipientProfileIds = Array.from(
        new Set(
          [leadManagerId, leadAssignedTo, closerId]
            .filter((profileId): profileId is string => !!profileId)
            .filter((profileId) => profileId !== createdByProfileId)
        )
      );

      const teamRecipients = await prisma.teamMember.findMany({
        where: {
          teamId,
          profileId: { in: candidateRecipientProfileIds },
        },
        select: { profileId: true },
      });
      const recipientProfileIds = teamRecipients.map((member) => member.profileId);

      if (recipientProfileIds.length > 0) {
        await notificationService.createScheduleNotification({
          teamId,
          actorProfileId: createdByProfileId,
          actorName: schedulerLabel,
          leadId,
          leadCode: leadCode ?? null,
          leadName,
          meetingDate,
          recipientProfileIds,
          isReschedule: !!existingSchedule,
        });
      }
    } catch (notificationError) {
      console.error(`${LOG_PREFIX} Erro ao criar notificações de agendamento:`, notificationError);
    }

    // --- Build response ---
    const successMessages = [persisted.message];
    if (inviteDispatchStatus === "sent_resend" && googleDispatchError) {
      successMessages.push(`Aviso: Google Calendar falhou (${googleDispatchError}). Convite enviado via e-mail (Resend).`);
    }

    const inviteDispatch: InviteDispatchPublicResult = {
      status: inviteDispatchStatus,
      provider: inviteDispatchProvider,
      fallbackUsed: inviteDispatchFallbackUsed,
      attemptedAt: inviteDispatchLastAttemptAt.toISOString(),
      error: inviteDispatchLastError,
    };

    return new Output(
      true,
      successMessages,
      [],
      {
        ...persisted.schedule,
        status: persisted.lead.status,
        inviteDispatch,
      }
    );
  }
}

export const leadScheduleService = new LeadScheduleService();
