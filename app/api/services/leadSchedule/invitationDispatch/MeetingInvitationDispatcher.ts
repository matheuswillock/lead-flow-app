import type { InviteDispatchStatus, Prisma } from "@prisma/client";
import { resolveBestEffortCalendarFailure } from "../resolveBestEffortCalendarFailure";
import { googleCalendarInviteStrategy } from "@/lib/leadSchedule/invitationDispatch/GoogleCalendarInviteStrategy";
import { resendIcsInviteStrategy } from "@/lib/leadSchedule/invitationDispatch/ResendIcsInviteStrategy";
import type { IGoogleCalendarInviteStrategy } from "./IGoogleCalendarInviteStrategy";
import type { IResendIcsInviteStrategy } from "./IResendIcsInviteStrategy";
import type {
  DispatchMeetingInvitationInput,
  DispatchMeetingInvitationResult,
  IMeetingInvitationDispatcher,
} from "./IMeetingInvitationDispatcher";
import type {
  CalendarEventResult,
  GoogleCalendarLogEvent,
  InviteDispatchActivityEvent,
  InviteDispatchProvider,
} from "./types";

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

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E3. Ver `IMeetingInvitationDispatcher`
 * para o contexto da extração. Estado local (`calendarResult`,
 * `inviteDispatchStatus`, …) só existe durante uma chamada de `dispatch` —
 * nada de campo de instância mutável, então a mesma instância é segura para
 * chamadas concorrentes.
 */
export class MeetingInvitationDispatcher implements IMeetingInvitationDispatcher {
  constructor(
    private readonly googleStrategy: IGoogleCalendarInviteStrategy = googleCalendarInviteStrategy,
    private readonly resendStrategy: IResendIcsInviteStrategy = resendIcsInviteStrategy
  ) {}

  async dispatch(input: DispatchMeetingInvitationInput): Promise<DispatchMeetingInvitationResult> {
    const activityEvents: InviteDispatchActivityEvent[] = [];
    const googleCalendarLogEvents: GoogleCalendarLogEvent[] = [];

    let calendarResult: CalendarEventResult | null = null;
    let calendarSyncWarning: string | null = null;
    let googleDispatchError: string | null = null;
    let inviteDispatchStatus: InviteDispatchStatus = "failed";
    let inviteDispatchProvider: InviteDispatchProvider = "resend";
    let inviteDispatchFallbackUsed = false;
    let inviteDispatchLastError: string | null = null;
    let inviteDispatchLastPayload: Prisma.InputJsonValue | null = null;

    const fail = (errorMessage: string) =>
      ({ ok: false as const, errorMessage, activityEvents, googleCalendarLogEvents });

    // --- Google Calendar attempt (Online) ---
    if (input.isOnlineMeeting && input.canUseGoogleCalendar) {
      if (input.googleRecipients.length === 0) {
        return fail(
          "Não foi possível concluir o agendamento: nenhum participante elegível para Google Calendar."
        );
      }

      try {
        calendarResult = await this.googleStrategy.dispatch({
          ...input.googleCalendarEventInput,
          closerEmail: input.closerEmail,
          meetingTitle: input.resolvedMeetingTitle,
          attendeeEmails: input.googleRecipients,
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
          ...input.participantDispatchMetadata,
        };

        activityEvents.push({
          provider: "google",
          status: "sent_google",
          fallbackUsed: false,
          recipients: input.googleRecipients,
          error: null,
          metadata: inviteDispatchLastPayload,
        });
        googleCalendarLogEvents.push({
          recipients: input.googleRecipients,
          subject: input.resolvedMeetingTitle,
          sourceId: input.scheduleId,
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
          ...input.participantDispatchMetadata,
        };

        activityEvents.push({
          provider: "google",
          status: "failed",
          fallbackUsed: false,
          recipients: input.googleRecipients,
          error: googleDispatchError,
          metadata: inviteDispatchLastPayload,
        });
        googleCalendarLogEvents.push({
          recipients: input.googleRecipients,
          subject: input.resolvedMeetingTitle,
          sourceId: input.scheduleId,
          success: false,
          errorMessage: googleDispatchError,
        });

        return fail(
          `Não foi possível concluir o agendamento porque o envio via Google Calendar falhou (${googleDispatchError}).`
        );
      }
    } else if (input.isOnlineMeeting) {
      googleDispatchError = "Conta Google não conectada. Evento não foi criado no Google Calendar.";
      activityEvents.push({
        provider: "google",
        status: "failed",
        fallbackUsed: false,
        recipients: input.attendeeEmails,
        error: googleDispatchError,
        metadata: {
          provider: "google",
          reason: "google_not_connected",
          ...input.participantDispatchMetadata,
        },
      });
    }

    // `googleCalendarEventInput.meetingLink` já chega como
    // `calendarTransfer.meetingLinkForUpsert` (calculado pelo chamador) —
    // mesma fórmula de antes da extração, só com o nome do campo diferente.
    const resolvedMeetingLink = input.isOnlineMeeting
      ? input.googleCalendarEventInput.meetingLink?.trim() ||
        input.normalizedMeetingLink?.trim() ||
        calendarResult?.meetLink ||
        null
      : null;

    if (input.isOnlineMeeting && !resolvedMeetingLink?.trim()) {
      return fail("Não foi possível concluir o agendamento sem um link válido da reunião.");
    }

    // --- Lead notification email + closer's personal calendar event (Ligação/WhatsApp) ---
    if (!input.isOnlineMeeting) {
      const meetingFormatLabel = input.resolvedMeetingType === "call" ? "Ligação" : "WhatsApp";
      const contactEmailResult = await this.resendStrategy.sendContactNotification({
        to: input.leadEmail.trim(),
        leadName: input.leadName,
        meetingDate: input.googleCalendarEventInput.meetingDate,
        meetingType: input.resolvedMeetingType as "call" | "whatsapp",
        closerName: input.closerName,
        closerPhone: input.closerPhone,
        timezone: input.timezone,
        teamId: input.teamId,
        sourceType: "leads_schedule",
        sourceId: input.scheduleId,
      });

      if (!contactEmailResult.success) {
        const contactEmailError =
          contactEmailResult.error || "Não foi possível enviar o e-mail ao lead.";
        inviteDispatchLastPayload = {
          provider: "resend",
          reason: `meeting_type_${input.resolvedMeetingType}`,
          error: contactEmailError,
        };

        activityEvents.push({
          provider: "resend",
          status: "failed",
          fallbackUsed: false,
          recipients: [input.leadEmail.trim()],
          error: contactEmailError,
          metadata: inviteDispatchLastPayload,
        });

        return fail(
          `Não foi possível concluir o agendamento porque o e-mail ao lead não foi enviado (${contactEmailError}).`
        );
      }

      inviteDispatchStatus = "sent_resend";
      inviteDispatchProvider = "resend";
      inviteDispatchLastError = null;
      inviteDispatchLastPayload = {
        provider: "resend",
        reason: `meeting_type_${input.resolvedMeetingType}`,
      };
      activityEvents.push({
        provider: "resend",
        status: "sent_resend",
        fallbackUsed: false,
        recipients: [input.leadEmail.trim()],
        error: null,
        metadata: inviteDispatchLastPayload,
      });

      if (input.canUseGoogleCalendar) {
        try {
          calendarResult = await this.googleStrategy.dispatch({
            ...input.googleCalendarEventInput,
            closerEmail: input.closerEmail,
            meetingTitle: input.resolvedMeetingTitle,
            attendeeEmails: [],
            meetingFormatLabel,
            // O evento pessoal best-effort não repete a transferência do
            // closer anterior — o cancelamento já foi tentado (ou não se
            // aplicava) na primeira chamada, se o closer tiver Google.
            transfer: undefined,
          });
        } catch (calendarError) {
          const calendarFailure = resolveBestEffortCalendarFailure({
            existingGoogleEventId: input.existingSchedule?.googleEventId,
            errorMessage: getErrorMessage(calendarError, "erro desconhecido"),
          });
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
    if (input.isOnlineMeeting && input.resendRecipients.length > 0) {
      const emailResult = await this.resendStrategy.sendParticipantInvite({
        to: input.resendRecipients,
        leadName: input.leadName,
        meetingTitle: input.resolvedMeetingTitle,
        meetingDate: input.googleCalendarEventInput.meetingDate,
        meetingLink: resolvedMeetingLink,
        organizerName: input.closerName,
        organizerEmail: input.closerEmail,
        eventUid: input.scheduleId,
        timezone: input.timezone,
        teamId: input.teamId,
        sourceType: "leads_schedule",
        sourceId: input.scheduleId,
      });

      if (emailResult.success) {
        const resendMessageId =
          "data" in emailResult ? extractResendMessageId(emailResult.data) : null;
        if (!input.canUseGoogleCalendar) {
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
            recipientCount: input.resendRecipients.length,
          },
          ...input.participantDispatchMetadata,
        };

        activityEvents.push({
          provider: "resend",
          status: "sent_resend",
          fallbackUsed: false,
          recipients: input.resendRecipients,
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
          recipientCount: input.resendRecipients.length,
          googleError: googleDispatchError,
          resendError,
          ...input.participantDispatchMetadata,
        };

        activityEvents.push({
          provider: "resend",
          status: "failed",
          fallbackUsed: false,
          recipients: input.resendRecipients,
          error: resendError,
          metadata: inviteDispatchLastPayload,
        });

        const reason = input.canUseGoogleCalendar
          ? `falhou o envio por e-mail para participantes sem Google conectado (${resendError})`
          : `falhou o envio por e-mail (${resendError})`;
        return fail(`Não foi possível concluir o agendamento porque ${reason}.`);
      }
    }

    if (input.isOnlineMeeting && inviteDispatchStatus === "failed") {
      const reason = inviteDispatchLastError || googleDispatchError || "Falha no envio do convite";
      return fail(
        `Não foi possível concluir o agendamento porque o convite não foi enviado com sucesso (${reason}).`
      );
    }

    return {
      ok: true,
      calendarResult,
      calendarSyncWarning,
      googleDispatchError,
      resolvedMeetingLink,
      inviteDispatchStatus,
      inviteDispatchProvider,
      inviteDispatchFallbackUsed,
      inviteDispatchLastError,
      inviteDispatchLastPayload,
      activityEvents,
      googleCalendarLogEvents,
    };
  }
}

export const meetingInvitationDispatcher = new MeetingInvitationDispatcher();
