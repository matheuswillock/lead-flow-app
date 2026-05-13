import { randomUUID } from "node:crypto";
import { ActivityType, InviteDispatchStatus, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { upsertCalendarEvent } from "@/app/api/services/googleCalendar/GoogleCalendarService";
import { emailService } from "@/lib/services/EmailService";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { Output } from "@/lib/output";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { validateMeetingLinkValue } from "@/lib/validations/meetingLink";
import type { ILeadScheduleService, CreateScheduleParams } from "./ILeadScheduleService";
import { buildUniqueEmails, resolveParticipantDispatchGroups } from "./participantDispatch";
import type { Attachment } from "resend";
import { formatIntimezone, resolveTimezone } from "@/lib/dates";

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
  future_sale: "Venda Futura",
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

const formatMeetingDate = (date: Date, tz: string) => formatIntimezone(date, "dd/MM/yyyy HH:mm", tz);

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const toUserFacingGoogleCalendarError = (rawError: string): string => {
  const normalized = rawError.toLowerCase();

  if (normalized.includes("insufficient authentication scopes")) {
    return "a conta Google do closer está conectada sem as permissões necessárias para criar eventos. Peça para reconectar o Google Calendar em Conta e tente novamente.";
  }

  return rawError;
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

    const closerEmail = closerProfile.email.trim().toLowerCase();
    const resolvedMeetingTitle = meetingTitle || `Estudo Plano de Saúde: ${leadName}`;
    const participantDispatch = await resolveParticipantDispatchGroups({
      teamId,
      emails: [
        leadEmail,
        closerEmail,
        leadAssigneeEmail,
        ...(extraGuests ?? []),
      ],
    });
    const attendeeEmails = participantDispatch.all;
    const canUseGoogleCalendar = !!closerProfile.googleCalendarConnected && !!closerProfile.googleRefreshToken;
    // When Google Calendar is available, ALL participants are added as attendees on the event
    // and Google handles delivery to every address (including external guests).
    // Resend is only used when Google is not connected.
    const googleRecipients = canUseGoogleCalendar ? attendeeEmails : [];
    const resendRecipients = canUseGoogleCalendar ? [] : attendeeEmails;
    const participantDispatchMetadata = {
      googleEligible: participantDispatch.googleEligible,
      resendRequired: participantDispatch.resendRequired,
      internalConnected: participantDispatch.internalConnected,
      internalDisconnected: participantDispatch.internalDisconnected,
      externalOrUnknown: participantDispatch.externalOrUnknown,
      googleRecipients,
      resendRecipients,
    };
    const manualLinkRequired = !canUseGoogleCalendar;
    const validatedMeetingLink = validateMeetingLinkValue(meetingLink, {
      required: manualLinkRequired,
    });

    if (!validatedMeetingLink.isValid) {
      if (manualLinkRequired && !meetingLink?.trim()) {
        return new Output(
          false,
          [],
          ["Closer sem Google conectado. Informe um link manual da reunião para continuar."],
          null
        );
      }

      return new Output(
        false,
        [],
        [validatedMeetingLink.error],
        null
      );
    }
    const normalizedMeetingLink = validatedMeetingLink.normalized;

    let schedulerLabel = "Usuário";
    try {
      const schedulerProfile = await prisma.profile.findUnique({
        where: { id: createdByProfileId },
        select: { fullName: true, email: true },
      });

      schedulerLabel = schedulerProfile?.fullName || schedulerProfile?.email || "Usuário";
    } catch (schedulerError) {
      console.warn(`${LOG_PREFIX} Não foi possível resolver o scheduler para logs e notificação:`, schedulerError);
    }

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
      if (googleRecipients.length === 0) {
        return new Output(
          false,
          [],
          ["Não foi possível concluir o agendamento: nenhum participante elegível para Google Calendar."],
          null
        );
      }

      try {
        calendarResult = await upsertCalendarEvent({
          organizer: closerProfile,
          lead: { id: leadId, name: leadName, email: leadEmail } as any,
          closerEmail,
          sdrEmail: leadAssigneeEmail,
          meetingDate,
          meetingTitle: resolvedMeetingTitle,
          notes: meetingNotes,
          meetingLink: normalizedMeetingLink,
          extraGuests,
          attendeeEmails: googleRecipients,
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
          ...participantDispatchMetadata,
        };

        await registerInviteDispatchActivity({
          leadId,
          createdBy: createdByProfileId,
          provider: "google",
          status: "sent_google",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: googleRecipients,
          error: null,
          metadata: inviteDispatchLastPayload,
        });
      } catch (calendarError) {
        const rawGoogleDispatchError = getErrorMessage(
          calendarError,
          "Falha ao criar evento no Google Calendar"
        );
        googleDispatchError = toUserFacingGoogleCalendarError(rawGoogleDispatchError);
        inviteDispatchLastError = googleDispatchError;
        inviteDispatchLastPayload = {
          provider: "google",
          rawError: rawGoogleDispatchError,
          error: googleDispatchError,
          ...participantDispatchMetadata,
        };
        console.error(
          `${LOG_PREFIX} Falha no disparo de convite via Google Calendar`,
          {
            leadId,
            scheduleId,
            errorMessage: rawGoogleDispatchError,
            userMessage: googleDispatchError,
            googleRecipients,
          },
          calendarError
        );
        await registerInviteDispatchActivity({
          leadId,
          createdBy: createdByProfileId,
          provider: "google",
          status: "failed",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: googleRecipients,
          error: googleDispatchError,
          metadata: inviteDispatchLastPayload,
        });

        return new Output(
          false,
          [],
          [`Não foi possível concluir o agendamento porque o envio via Google Calendar falhou (${googleDispatchError}).`],
          null
        );
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
        metadata: {
          provider: "google",
          reason: "google_not_connected",
          ...participantDispatchMetadata,
        },
      });
    }

    const resolvedMeetingLink = normalizedMeetingLink?.trim() || calendarResult?.meetLink || null;

    if (!resolvedMeetingLink?.trim()) {
      return new Output(
        false,
        [],
        ["Não foi possível concluir o agendamento sem um link válido da reunião."],
        null
      );
    }

    // --- Resend email dispatch for participants sem Google conectado ---
    if (resendRecipients.length > 0) {
      const organizerName = closerProfile.fullName || closerProfile.email;
      const emailResult = await emailService.sendMeetingInviteEmail({
        to: resendRecipients,
        leadName,
        meetingTitle: resolvedMeetingTitle,
        meetingDate,
        meetingLink: resolvedMeetingLink,
        organizerName,
        organizerEmail: closerEmail,
        eventUid: scheduleId,
        timezone: closerProfile.timezone,
      });

      if (emailResult.success) {
        const resendMessageId = extractResendMessageId(emailResult.data);
        if (!canUseGoogleCalendar) {
          inviteDispatchStatus = "sent_resend";
          inviteDispatchProvider = "resend";
        }
        inviteDispatchFallbackUsed = false;
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
          createdBy: createdByProfileId,
          provider: "resend",
          status: "sent_resend",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: resendRecipients,
          error: null,
          metadata: inviteDispatchLastPayload,
        });
      } else {
        const resendError = emailResult.error || "Convite por e-mail não pôde ser enviado.";
        inviteDispatchStatus = "failed";
        inviteDispatchProvider = "resend";
        inviteDispatchFallbackUsed = false;
        inviteDispatchLastError = resendError;
        inviteDispatchLastPayload = {
          provider: "resend",
          recipientCount: resendRecipients.length,
          googleError: googleDispatchError,
          resendError,
          ...participantDispatchMetadata,
        };
        console.error(`${LOG_PREFIX} Falha no disparo de convite via Resend`, {
          leadId,
          scheduleId,
          errorMessage: resendError,
          resendRecipients,
        });
        await registerInviteDispatchActivity({
          leadId,
          createdBy: createdByProfileId,
          provider: "resend",
          status: "failed",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: resendRecipients,
          error: resendError,
          metadata: inviteDispatchLastPayload,
        });

        const reason = canUseGoogleCalendar
          ? `falhou o envio por e-mail para participantes sem Google conectado (${resendError})`
          : `falhou o envio por e-mail (${resendError})`;
        return new Output(
          false,
          [],
          [`Não foi possível concluir o agendamento porque ${reason}.`],
          null
        );
      }
    }

    if (inviteDispatchStatus !== "failed") {
      try {
        const scheduleAttachments = await this.buildLeadScheduleAttachments(leadId);

        await emailService.sendCloserScheduleNotificationEmail({
          to: closerEmail,
          closerName: closerProfile.fullName || closerProfile.email,
          leadName,
          meetingTitle: resolvedMeetingTitle,
          meetingDate,
          meetingLink: resolvedMeetingLink,
          leadCode,
          isReschedule: !!existingSchedule,
          attendees: attendeeEmails,
          notes: meetingNotes ?? null,
          attachments: scheduleAttachments,
          timezone: closerProfile.timezone,
        });
      } catch (closerNotificationError) {
        console.warn(
          `${LOG_PREFIX} Falha ao enviar notificação ao closer (não-bloqueante):`,
          closerNotificationError
        );
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
    try {
      const actionLabel = existingSchedule ? "Reagendamento feito por" : "Agendamento feito por";

      const participants = buildUniqueEmails([
        leadEmail,
        closerProfile.email,
        leadAssigneeEmail,
        ...(extraGuests ?? []),
      ]);
      const meetingTimezone = resolveTimezone(closerProfile.timezone);
      const participantLines = participants.map((email) => `• ${email}`);

      const bodyLines = [
        `${actionLabel} ${schedulerLabel} para ${formatMeetingDate(meetingDate, meetingTimezone)}.`,
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
    if (canUseGoogleCalendar && resendRecipients.length > 0) {
      successMessages.push(
        "Aviso: Participantes sem Google conectado receberam convite via e-mail (Resend)."
      );
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

  private async buildLeadScheduleAttachments(leadId: string): Promise<Attachment[]> {
    try {
      const leadAttachments = await prisma.leadAttachment.findMany({
        where: { leadId },
        select: {
          id: true,
          fileName: true,
          fileType: true,
          storagePath: true,
          fileUrl: true,
        },
        orderBy: { uploadedAt: "asc" },
      });

      if (leadAttachments.length === 0) {
        return [];
      }

      const supabaseAdmin = createSupabaseAdmin();
      const attachments: Attachment[] = [];

      for (const leadAttachment of leadAttachments) {
        try {
          let buffer: Buffer | null = null;

          const storagePath = leadAttachment.storagePath?.trim();
          if (supabaseAdmin && storagePath) {
            const { data, error } = await supabaseAdmin.storage
              .from(STORAGE_BUCKETS.LEAD_ATTACHMENTS)
              .download(storagePath);

            if (error) {
              console.error(`${LOG_PREFIX} Erro ao baixar anexo do storage para e-mail de agendamento:`, {
                leadId,
                attachmentId: leadAttachment.id,
                storagePath,
                error,
              });
            } else if (data) {
              buffer = Buffer.from(await data.arrayBuffer());
            }
          }

          if (!buffer && leadAttachment.fileUrl) {
            const response = await fetch(leadAttachment.fileUrl);
            if (!response.ok) {
              throw new Error(`Falha ao baixar arquivo via URL pública: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
          }

          if (!buffer) {
            continue;
          }

          attachments.push({
            filename: leadAttachment.fileName || `documento-${leadAttachment.id}`,
            content: buffer,
            ...(leadAttachment.fileType ? { contentType: leadAttachment.fileType } : {}),
          });
        } catch (error) {
          console.error(`${LOG_PREFIX} Erro ao preparar anexo de lead para e-mail de agendamento:`, {
            leadId,
            attachmentId: leadAttachment.id,
            error,
          });
        }
      }

      return attachments;
    } catch (error) {
      console.error(`${LOG_PREFIX} Erro ao listar anexos do lead para e-mail de agendamento:`, {
        leadId,
        error,
      });
      return [];
    }
  }
}

export const leadScheduleService = new LeadScheduleService();
