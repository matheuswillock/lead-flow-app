import { randomUUID } from "node:crypto";
import { ActivityType, InviteDispatchStatus, LeadStatus, Prisma } from "@prisma/client";
import type { CreateLeadActivityDTO } from "@/app/api/infra/data/repositories/leadActivity/ILeadActivityRepository";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { leadActivityRepository } from "@/app/api/infra/data/repositories/leadActivity/LeadActivityRepository";
import { leadAttachmentRepository } from "@/app/api/infra/data/repositories/leadAttachment/LeadAttachmentRepository";
import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { teamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository";
import { leadSchedulePersistenceRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadSchedulePersistenceRepository";
import {
  cancelCalendarEvent,
  upsertCalendarEvent,
} from "@/app/api/services/googleCalendar/GoogleCalendarService";
import { emailService } from "@/lib/services/EmailService";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { teamAutomationDispatcherService } from "@/app/api/services/teamAutomation/TeamAutomationDispatcherService";
import { outboundEventPublisher } from "@/app/api/services/teamWebhook/OutboundEventPublisher";
import { Output } from "@/lib/output";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { validateMeetingLinkValue } from "@/lib/validations/meetingLink";
import { getScheduleShareExpiry } from "@/lib/schedule-share";
import type { ILeadScheduleService, CreateScheduleParams } from "./ILeadScheduleService";
import { buildUniqueEmails, resolveParticipantDispatchGroups } from "./participantDispatch";
import { resolveCloserCalendarTransfer } from "./resolveCloserCalendarTransfer";
import { resolveBestEffortCalendarFailure } from "./resolveBestEffortCalendarFailure";
import type { Attachment } from "resend";
import { formatIntimezone, resolveTimezone } from "@/lib/dates";
import { isGoogleConnectionActive } from "@/lib/google/connection";
import { buildStudioActivityData } from "@/lib/studio-feed-identity";
import { meetingSlotReservationService } from "@/app/api/services/meetingSlotReservation/MeetingSlotReservationService";
import { teamScheduleSettingsRepository } from "@/app/api/infra/data/repositories/teamScheduleSettings/TeamScheduleSettingsRepository";
import {
  DEFAULT_MEETING_DURATION_MINUTES,
  isMeetingDurationMinutes,
} from "@/app/api/domain/teamScheduleSettings/meetingDuration";

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

const LOG_PREFIX = "[LeadScheduleService]";
const NO_SHOW_SCHEDULE_CONFIRMATION_THRESHOLD = 3;

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
    return "Convite enviado por e-mail após falha no Google Calendar.";
  }
  if (status === "sent_resend") {
    return "Convite enviado por e-mail";
  }
  if (provider === "google") {
    return error
      ? `Falha ao disparar convite via Google Calendar. Motivo: ${error}`
      : "Falha ao disparar convite via Google Calendar.";
  }
  if (fallbackUsed) {
    return error
      ? `Falha ao enviar convite por e-mail após falha no Google Calendar. Motivo: ${error}`
      : "Falha ao enviar convite por e-mail após falha no Google Calendar.";
  }
  return error
    ? `Falha ao enviar convite por e-mail. Motivo: ${error}`
    : "Falha ao enviar convite por e-mail.";
};

const registerInviteDispatchActivity = async ({
  leadId,
  provider,
  status,
  fallbackUsed,
  attemptedAt,
  recipients,
  error,
  metadata,
}: {
  leadId: string;
  provider: InviteDispatchProvider;
  status: InviteDispatchStatus;
  fallbackUsed: boolean;
  attemptedAt: Date;
  recipients: string[];
  error: string | null;
  metadata: Prisma.InputJsonValue | null;
}) => {
  try {
    await leadActivityRepository.create({
      leadId,
      ...buildStudioActivityData({
        type: ActivityType.note,
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
      }),
    });
  } catch (activityError) {
    console.warn(`${LOG_PREFIX} Não foi possível registrar atividade de disparo de convite:`, activityError);
  }
};

const buildAuthorActivityData = (
  authorAsStudio: boolean,
  createdByProfileId: string,
  input: {
    type: ActivityType;
    body: string;
    payload?: Prisma.InputJsonValue | Record<string, unknown> | null;
  }
): Omit<CreateLeadActivityDTO, "leadId"> =>
  authorAsStudio
    ? {
        ...buildStudioActivityData(input),
        type: input.type,
        body: input.body,
        createdBy: null,
      }
    : {
        type: input.type,
        body: input.body,
        payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        createdBy: createdByProfileId,
      };

export class LeadScheduleService implements ILeadScheduleService {
  async createSchedule(params: CreateScheduleParams): Promise<Output> {
    if (!params.meetingDate) {
      return new Output(false, [], ["Data da reunião é obrigatória."], null);
    }

    const meetingDate = new Date(params.meetingDate);
    if (Number.isNaN(meetingDate.getTime())) {
      return new Output(false, [], ["Data da reunião inválida."], null);
    }

    const configuredDuration = await teamScheduleSettingsRepository.findMeetingDuration(params.teamId);
    const durationMinutes = isMeetingDurationMinutes(configuredDuration)
      ? configuredDuration
      : DEFAULT_MEETING_DURATION_MINUTES;
    const reservation = params.reservationId
      ? { available: true as const, reservationId: params.reservationId, durationMinutes }
      : await meetingSlotReservationService.reserve({
          teamId: params.teamId,
          closerId: params.closerId,
          leadId: params.leadId,
          startsAt: meetingDate,
          source: params.reservationSource ?? "internal",
        });
    if (!reservation.available) {
      return new Output(false, [], ["Este horário não está mais disponível."], null);
    }

    try {
      if (params.reservationId) {
        await meetingSlotReservationService.attachToLead({
          reservationId: params.reservationId,
          leadId: params.leadId,
        });
      }
      const output = await this.createScheduleWithoutReservation(params);
      if (!output.isValid) {
        await meetingSlotReservationService.release(reservation.reservationId);
        return output;
      }

      const result = output.result as { googleEventId?: string | null; googleCalendarId?: string | null } | null;
      await meetingSlotReservationService.consume({
        reservationId: reservation.reservationId,
        leadId: params.leadId,
        googleEventId: result?.googleEventId ?? null,
        googleCalendarId: result?.googleCalendarId ?? null,
      });
      return output;
    } catch (error) {
      // A implementação só libera reservas sem evento externo. Com evento
      // Google registrado, a linha permanece recuperável para reconciliação.
      await meetingSlotReservationService.release(reservation.reservationId);
      throw error;
    }
  }

  private async createScheduleWithoutReservation(params: CreateScheduleParams): Promise<Output> {
    const {
      leadId,
      leadName,
      leadEmail,
      leadStatus,
      leadManagerId,
      leadAssignedTo,
      leadAssigneeEmail,
      leadCurrentCloserId,
      leadMeetingLink,
      leadCode,
      closerId,
      teamId,
      meetingDate: meetingDateISO,
      meetingTitle,
      meetingNotes,
      meetingLink,
      meetingType,
      durationMinutes: requestedDurationMinutes,
      extraGuests,
      createdByProfileId,
      transitionStatusToScheduled,
      confirmNoShowSchedule,
      authorAsStudio = false,
    } = params;

    const resolvedMeetingType = meetingType ?? "online";
    const isOnlineMeeting = resolvedMeetingType === "online";
    if (!meetingDateISO) {
      return new Output(false, [], ["Data da reunião é obrigatória."], null);
    }
    const meetingDate = new Date(meetingDateISO);
    const configuredDuration = await teamScheduleSettingsRepository.findMeetingDuration(teamId);
    const durationMinutes = isMeetingDurationMinutes(configuredDuration)
      ? configuredDuration
      : DEFAULT_MEETING_DURATION_MINUTES;
    if (requestedDurationMinutes && requestedDurationMinutes !== durationMinutes) {
      console.info(`${LOG_PREFIX} Duração enviada pelo cliente foi ignorada em favor da configuração do time.`);
    }
    const shouldLogCloserChange = closerId !== leadCurrentCloserId;

    const existingSchedule = await leadScheduleRepository.findLatestByLeadId(leadId);
    const scheduleId = existingSchedule?.id ?? randomUUID();
    const noShowCount = existingSchedule?.noShowCount ?? 0;
    const isReschedule = !!(existingSchedule?.googleEventId);

    if (
      leadStatus === LeadStatus.no_show &&
      noShowCount >= NO_SHOW_SCHEDULE_CONFIRMATION_THRESHOLD &&
      !confirmNoShowSchedule
    ) {
      return new Output(
        false,
        [],
        [
          `Este lead já teve no-show ${noShowCount} vezes. Confirme para continuar com o agendamento.`,
        ],
        {
          requiresNoShowConfirmation: true,
          noShowCount,
          threshold: NO_SHOW_SCHEDULE_CONFIRMATION_THRESHOLD,
        }
      );
    }

    const closerProfile = await profileRepository.findWithGoogleConnectionById(closerId);

    if (!closerProfile || !closerProfile.email) {
      return new Output(false, [], ["Closer não encontrado ou sem e-mail válido."], null);
    }

    if (isOnlineMeeting && !leadEmail?.trim()) {
      return new Output(
        false,
        [],
        ["Lead precisa de um email para agendar a reunião. Preencha o email do lead antes de agendar."],
        null
      );
    }

    const closerEmail = closerProfile.email.trim().toLowerCase();
    const participantEmails = [
      leadEmail?.trim().toLowerCase(),
      closerEmail,
      leadAssigneeEmail?.trim().toLowerCase(),
      ...(extraGuests ?? []),
    ].filter((email): email is string => Boolean(email));
    const resolvedMeetingTitle = meetingTitle || `Estudo Plano de Saúde: ${leadName}`;
    const participantDispatch = await resolveParticipantDispatchGroups({
      teamId,
      emails: participantEmails,
    });
    const attendeeEmails = participantDispatch.all;
    const canUseGoogleCalendar = isGoogleConnectionActive(closerProfile.googleConnection);
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
    const manualLinkRequired = isOnlineMeeting && !canUseGoogleCalendar;
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

    const calendarTransfer = resolveCloserCalendarTransfer({
      closerId,
      leadCurrentCloserId,
      existingGoogleEventId: existingSchedule?.googleEventId,
      existingMeetingLink: existingSchedule?.meetingLink,
      leadMeetingLink,
      requestMeetingLink: normalizedMeetingLink,
    });

    let schedulerLabel = "Usuário";
    try {
      const schedulerProfile = await profileRepository.findById(createdByProfileId);

      schedulerLabel = schedulerProfile?.fullName || schedulerProfile?.email || "Usuário";
    } catch (schedulerError) {
      console.warn(`${LOG_PREFIX} Não foi possível resolver o scheduler para logs e notificação:`, schedulerError);
    }

    let calendarResult: CalendarEventResult | null = null;
    let calendarSyncWarning: string | null = null;
    let googleDispatchError: string | null = null;

    let inviteDispatchStatus: InviteDispatchStatus = "failed";
    let inviteDispatchProvider: InviteDispatchProvider = "resend";
    let inviteDispatchFallbackUsed = false;
    let inviteDispatchLastError: string | null = null;
    let inviteDispatchLastPayload: Prisma.InputJsonValue | null = null;
    const inviteDispatchLastAttemptAt = new Date();

    // Upserts the Google Calendar event on the closer's own calendar and, when the
    // closer changed since the last schedule, cancels the previous closer's event.
    // Reused by the Online flow (mandatory) and the Ligação/WhatsApp flow (best-effort).
    const attemptCloserCalendarUpsert = async (options: {
      attendeeEmails: string[];
      meetingFormatLabel?: string | null;
    }): Promise<CalendarEventResult> => {
      const result = await upsertCalendarEvent({
        organizer: closerProfile,
        lead: { id: leadId, name: leadName, email: leadEmail } as any,
        closerEmail,
        sdrEmail: leadAssigneeEmail,
        meetingDate,
        meetingTitle: resolvedMeetingTitle,
        notes: meetingNotes,
        meetingLink: calendarTransfer.meetingLinkForUpsert,
        meetingFormatLabel: options.meetingFormatLabel ?? null,
        extraGuests,
        attendeeEmails: options.attendeeEmails,
        existingEventId: calendarTransfer.existingEventIdForUpsert,
        durationMinutes,
      });

      // Cancel the previous closer's event only after the new one succeeds,
      // so a failed upsert does not leave the lead without a calendar invite.
      if (
        calendarTransfer.shouldTransferCalendarOwnership &&
        calendarTransfer.previousCloserId &&
        calendarTransfer.previousEventId
      ) {
        try {
          const previousCloserProfile = await profileRepository.findWithGoogleConnectionById(
            calendarTransfer.previousCloserId,
          );

          if (
            previousCloserProfile &&
            isGoogleConnectionActive(previousCloserProfile.googleConnection)
          ) {
            await cancelCalendarEvent({
              organizer: previousCloserProfile,
              eventId: calendarTransfer.previousEventId,
              calendarId: existingSchedule?.googleCalendarId ?? "primary",
            });
            console.info(`${LOG_PREFIX} Evento cancelado no Calendar do closer anterior`, {
              leadId,
              previousCloserId: calendarTransfer.previousCloserId,
              previousEventId: calendarTransfer.previousEventId,
              newCloserId: closerId,
              newEventId: result.eventId,
            });
          } else {
            console.warn(
              `${LOG_PREFIX} Closer anterior sem Google conectado; evento antigo pode ficar órfão`,
              {
                leadId,
                previousCloserId: calendarTransfer.previousCloserId,
                previousEventId: calendarTransfer.previousEventId,
              }
            );
          }
        } catch (cancelPreviousError) {
          console.warn(
            `${LOG_PREFIX} Falha ao cancelar evento no Calendar do closer anterior após criar o novo`,
            {
              leadId,
              previousCloserId: calendarTransfer.previousCloserId,
              previousEventId: calendarTransfer.previousEventId,
              newEventId: result.eventId,
              error:
                cancelPreviousError instanceof Error
                  ? cancelPreviousError.message
                  : String(cancelPreviousError),
            }
          );
        }
      }

      return result;
    };

    // --- Google Calendar attempt (Online) ---
    if (isOnlineMeeting && canUseGoogleCalendar) {
      if (googleRecipients.length === 0) {
        return new Output(
          false,
          [],
          ["Não foi possível concluir o agendamento: nenhum participante elegível para Google Calendar."],
          null
        );
      }

      try {
        calendarResult = await attemptCloserCalendarUpsert({ attendeeEmails: googleRecipients });
        if (params.reservationId) {
          await meetingSlotReservationService.markExternalEvent({
            reservationId: params.reservationId,
            googleEventId: calendarResult.eventId,
            googleCalendarId: calendarResult.calendarId,
          });
        }

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
          provider: "google",
          status: "sent_google",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: googleRecipients,
          error: null,
          metadata: inviteDispatchLastPayload,
        });

        const { logGoogleCalendarDispatchesForRecipients } = await import(
          "@/lib/email/log-profile-email-dispatches"
        );
        await logGoogleCalendarDispatchesForRecipients({
          recipients: googleRecipients,
          subject: resolvedMeetingTitle,
          category: "schedule_invite",
          sourceType: "leads_schedule",
          sourceId: scheduleId,
          success: true,
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
          provider: "google",
          status: "failed",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: googleRecipients,
          error: googleDispatchError,
          metadata: inviteDispatchLastPayload,
        });

        const { logGoogleCalendarDispatchesForRecipients } = await import(
          "@/lib/email/log-profile-email-dispatches"
        );
        await logGoogleCalendarDispatchesForRecipients({
          recipients: googleRecipients,
          subject: resolvedMeetingTitle,
          category: "schedule_invite",
          sourceType: "leads_schedule",
          sourceId: scheduleId,
          success: false,
          errorMessage: googleDispatchError,
        });

        return new Output(
          false,
          [],
          [`Não foi possível concluir o agendamento porque o envio via Google Calendar falhou (${googleDispatchError}).`],
          null
        );
      }
    } else if (isOnlineMeeting) {
      googleDispatchError = "Conta Google não conectada. Evento não foi criado no Google Calendar.";
      console.warn(`${LOG_PREFIX} Google Calendar não conectado para closer`, { leadId, closerId });
      await registerInviteDispatchActivity({
        leadId,
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

    const resolvedMeetingLink = isOnlineMeeting
      ? calendarTransfer.meetingLinkForUpsert ||
        normalizedMeetingLink?.trim() ||
        calendarResult?.meetLink ||
        null
      : null;

    if (isOnlineMeeting && !resolvedMeetingLink?.trim()) {
      return new Output(
        false,
        [],
        ["Não foi possível concluir o agendamento sem um link válido da reunião."],
        null
      );
    }

    // --- Lead notification email + closer's personal calendar event (Ligação/WhatsApp) ---
    if (!isOnlineMeeting && leadEmail?.trim()) {
      const meetingFormatLabel = resolvedMeetingType === "call" ? "Ligação" : "WhatsApp";
      const contactEmailResult = await emailService.sendMeetingContactNotificationEmail({
        to: leadEmail.trim(),
        leadName,
        meetingDate,
        meetingType: resolvedMeetingType as "call" | "whatsapp",
        closerName: closerProfile.fullName || closerProfile.email,
        closerPhone: closerProfile.phone,
        timezone: closerProfile.timezone,
        teamId,
        sourceType: "leads_schedule",
        sourceId: scheduleId,
      });

      if (!contactEmailResult.success) {
        const contactEmailError = contactEmailResult.error || "Não foi possível enviar o e-mail ao lead.";
        inviteDispatchLastPayload = {
          provider: "resend",
          reason: `meeting_type_${resolvedMeetingType}`,
          error: contactEmailError,
        };
        console.error(`${LOG_PREFIX} Falha ao enviar e-mail de aviso de ${meetingFormatLabel} ao lead`, {
          leadId,
          scheduleId,
          errorMessage: contactEmailError,
        });
        await registerInviteDispatchActivity({
          leadId,
          provider: "resend",
          status: "failed",
          fallbackUsed: false,
          attemptedAt: inviteDispatchLastAttemptAt,
          recipients: [leadEmail.trim()],
          error: contactEmailError,
          metadata: inviteDispatchLastPayload,
        });

        return new Output(
          false,
          [],
          [`Não foi possível concluir o agendamento porque o e-mail ao lead não foi enviado (${contactEmailError}).`],
          null
        );
      }

      inviteDispatchStatus = "sent_resend";
      inviteDispatchProvider = "resend";
      inviteDispatchLastError = null;
      inviteDispatchLastPayload = {
        provider: "resend",
        reason: `meeting_type_${resolvedMeetingType}`,
      };
      await registerInviteDispatchActivity({
        leadId,
        provider: "resend",
        status: "sent_resend",
        fallbackUsed: false,
        attemptedAt: inviteDispatchLastAttemptAt,
        recipients: [leadEmail.trim()],
        error: null,
        metadata: inviteDispatchLastPayload,
      });

      if (canUseGoogleCalendar) {
        try {
          calendarResult = await attemptCloserCalendarUpsert({
            attendeeEmails: [],
            meetingFormatLabel,
          });
          if (params.reservationId) {
            await meetingSlotReservationService.markExternalEvent({
              reservationId: params.reservationId,
              googleEventId: calendarResult.eventId,
              googleCalendarId: calendarResult.calendarId,
            });
          }
        } catch (calendarError) {
          const calendarFailure = resolveBestEffortCalendarFailure({
            existingGoogleEventId: existingSchedule?.googleEventId,
            errorMessage: getErrorMessage(calendarError, "erro desconhecido"),
          });
          console.warn(
            `${LOG_PREFIX} Falha ao criar evento pessoal no Google Calendar do closer para ${meetingFormatLabel} — agendamento continua`,
            {
              leadId,
              scheduleId,
              error: calendarFailure.payload.error,
              staleEventId: calendarFailure.payload.staleEventId,
            }
          );
          calendarResult = null;
          inviteDispatchLastError = calendarFailure.lastError;
          inviteDispatchLastPayload = {
            ...(inviteDispatchLastPayload && typeof inviteDispatchLastPayload === "object"
              ? inviteDispatchLastPayload
              : {}),
            calendarSync: calendarFailure.payload,
          };
          calendarSyncWarning = calendarFailure.warning;
        }
      }
    }

    // --- Resend email dispatch for participants sem Google conectado ---
    if (isOnlineMeeting && resendRecipients.length > 0) {
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
        teamId,
        sourceType: "leads_schedule",
        sourceId: scheduleId,
      });

      if (emailResult.success) {
        const resendMessageId =
          "data" in emailResult ? extractResendMessageId(emailResult.data) : null;
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

    if (isOnlineMeeting && inviteDispatchStatus === "failed") {
      const reason = inviteDispatchLastError || googleDispatchError || "Falha no envio do convite";
      return new Output(
        false,
        [],
        [`Não foi possível concluir o agendamento porque o convite não foi enviado com sucesso (${reason}).`],
        null
      );
    }

    // --- Persist schedule + update lead ---
    const refreshedPublicShareExpiresAt = existingSchedule?.publicShareTokenHash
      ? getScheduleShareExpiry(meetingDate)
      : undefined;

    const persisted = await leadSchedulePersistenceRepository.persist({
      scheduleId,
      leadId,
      closerId,
      meetingDate,
      durationMinutes,
      resolvedMeetingTitle,
      meetingNotes,
      resolvedMeetingLink,
      resolvedMeetingType,
      extraGuests,
      calendarResult,
      inviteDispatchStatus,
      inviteDispatchFallbackUsed,
      inviteDispatchLastAttemptAt,
      inviteDispatchLastError,
      inviteDispatchLastPayload,
      publicShareExpiresAt: refreshedPublicShareExpiresAt,
      existingSchedule,
      isReschedule,
      transitionStatusToScheduled,
      leadStatus: leadStatus as LeadStatus,
      authorAsStudio,
      createdByProfileId,
    });

    const scheduleWarnings: string[] = [];
    if (calendarSyncWarning) {
      scheduleWarnings.push(calendarSyncWarning);
    }
    if (inviteDispatchStatus !== "failed") {
      try {
        const scheduleAttachments = await this.buildLeadScheduleAttachments(leadId);
        const leadPhoneForNotify = (await leadRepository.findById(leadId))?.phone ?? null;
        await emailService.sendCloserScheduleNotificationEmail({
          to: closerEmail,
          teamId,
          closerName: closerProfile.fullName || closerProfile.email,
          leadName,
          meetingTitle: resolvedMeetingTitle,
          meetingDate,
          meetingLink: resolvedMeetingLink,
          meetingType: resolvedMeetingType,
          leadCode,
          leadPhone: leadPhoneForNotify ?? null,
          isReschedule,
          attendees: attendeeEmails,
          notes: meetingNotes ?? null,
          attachments: scheduleAttachments,
          timezone: closerProfile.timezone,
        });
      } catch (closerNotificationError) {
        const closerNotificationMessage =
          "Agendamento criado, mas o e-mail de confirmação ao closer não foi enviado.";
        scheduleWarnings.push(closerNotificationMessage);
        console.warn(`${LOG_PREFIX} Falha ao enviar notificação ao closer:`, closerNotificationError);
        try {
          await leadActivityRepository.create({
            leadId,
            ...buildStudioActivityData({
              type: ActivityType.note,
              body: closerNotificationMessage,
              payload: {
                kind: "schedule",
                action: "closer_notification_failed",
                error:
                  closerNotificationError instanceof Error
                    ? closerNotificationError.message
                    : String(closerNotificationError),
              },
            }),
          });
        } catch (activityError) {
          console.warn(`${LOG_PREFIX} Falha ao registrar atividade de erro do closer:`, activityError);
        }
      }
    }

    // --- Fire-and-forget: activity logs + platform notifications ---
    void (async () => {
      try {
        const actionLabel = isReschedule ? "Reagendamento feito por" : "Agendamento feito por";
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
        await leadActivityRepository.create({
          leadId,
          ...buildAuthorActivityData(authorAsStudio, createdByProfileId, {
            type: ActivityType.note,
            body: bodyLines.join("\n"),
            payload: {
              kind: "schedule",
              meetingDate: meetingDate.toISOString(),
              meetingTitle: resolvedMeetingTitle,
              participants,
            },
          }),
        });
      } catch (activityError) {
        console.warn(`${LOG_PREFIX} Não foi possível registrar atividade de agendamento:`, activityError);
      }

      // Closer change activity
      if (shouldLogCloserChange) {
        try {
          const closerLabel = closerProfile.fullName || closerProfile.email || "Closer";
          await leadActivityRepository.create({
            leadId,
            type: ActivityType.note,
            body: `Closer alterado para ${closerLabel}`,
            payload: {
              previousCloserId: leadCurrentCloserId,
              closerId,
            },
            createdBy: createdByProfileId,
          });
        } catch (activityError) {
          console.warn(`${LOG_PREFIX} Não foi possível registrar atividade de alteração de closer:`, activityError);
        }
      }

      // Platform notifications
      try {
        const candidateRecipientProfileIds = Array.from(
          new Set(
            [leadManagerId, leadAssignedTo, closerId]
              .filter((profileId): profileId is string => !!profileId)
              .filter((profileId) => profileId !== createdByProfileId)
          )
        );
        const teamRecipients = await teamMembersRepository.findNotificationRecipientsByProfileIds({
          teamId,
          profileIds: candidateRecipientProfileIds,
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
            isReschedule,
          });
        }
      } catch (notificationError) {
        console.error(`${LOG_PREFIX} Erro ao criar notificações de agendamento:`, notificationError);
      }
    })().catch((err) => {
      console.error(`${LOG_PREFIX} Background dispatch error:`, err);
    });

    // --- Build response ---
    const successMessages = [persisted.message, ...scheduleWarnings];
    if (canUseGoogleCalendar && resendRecipients.length > 0) {
      successMessages.push(
        "Aviso: Participantes sem Google conectado receberam convite via e-mail ."
      );
    }

    const inviteDispatch: InviteDispatchPublicResult = {
      status: inviteDispatchStatus,
      provider: inviteDispatchProvider,
      fallbackUsed: inviteDispatchFallbackUsed,
      attemptedAt: inviteDispatchLastAttemptAt.toISOString(),
      error: inviteDispatchLastError,
    };

    teamAutomationDispatcherService
      .dispatch({
        type: "meeting_scheduled",
        teamId,
        leadId,
        data: {
          scheduleId: persisted.schedule.id,
          meetingDate: meetingDate.toISOString(),
        },
      })
      .catch(console.error);

    await outboundEventPublisher.publish({
      teamId,
      eventKey: "appointment_created",
      leadId,
      payload: {
        schedule: {
          id: persisted.schedule.id,
          meeting_date: meetingDate.toISOString(),
        },
      },
    }).catch((error) => {
            console.error("[OutboundEventPublisher] Falha ao enfileirar evento:", error);
          });

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
      const leadAttachments = await leadAttachmentRepository.findDownloadRefsByLeadId(leadId);

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
