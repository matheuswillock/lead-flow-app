import type { InviteDispatchStatus, Prisma } from "@prisma/client";
import type { GoogleCalendarInviteDispatchInput } from "./IGoogleCalendarInviteStrategy";
import type {
  CalendarEventResult,
  GoogleCalendarLogEvent,
  InviteDispatchActivityEvent,
  InviteDispatchProvider,
} from "./types";

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E3 — extração pura do trecho de
 * `LeadScheduleService.createSchedule` que decide COMO despachar o convite
 * (Google Calendar quando o closer tem conexão ativa, e-mail/`.ics` quando
 * não tem, aviso ao lead quando a reunião é por telefone/WhatsApp) e chama
 * as portas correspondentes. Mesmo comportamento de hoje (T-13.6: "com as
 * mesmas chamadas de hoje") — a mudança de "o tipo decide o que enviar" para
 * "o canal decide" é da DA6/A-E10, fora do escopo desta extração.
 *
 * Não toca banco (T-13.7): em vez de gravar a atividade de disparo
 * diretamente, devolve `activityEvents`/`googleCalendarLogEvents` — listas
 * do que aconteceu, prontas para o chamador (que já tem acesso a Prisma
 * hoje) registrar exatamente como registrava antes.
 */
export interface DispatchMeetingInvitationInput {
  isOnlineMeeting: boolean;
  canUseGoogleCalendar: boolean;
  leadId: string;
  leadEmail: string;
  leadName: string;
  /** Só para os logs terem o mesmo contexto que tinham antes da extração. */
  closerId: string;
  resolvedMeetingType: string;
  resolvedMeetingTitle: string;
  scheduleId: string;
  teamId: string;
  attendeeEmails: string[];
  googleRecipients: string[];
  resendRecipients: string[];
  participantDispatchMetadata: Record<string, unknown>;
  normalizedMeetingLink?: string;
  existingSchedule: { googleEventId: string | null } | null;
  /** Reaproveitado como `closerEmail` (Google) e `organizerEmail` (Resend) — mesmo valor nos dois lugares hoje. */
  closerEmail: string;
  /** `closerProfile.fullName || closerProfile.email` — já resolvido pelo chamador. */
  closerName: string;
  closerPhone?: string | null;
  timezone?: string | null;
  /** Repassado para `GoogleCalendarInviteStrategy` — ver esse arquivo para o formato completo. */
  googleCalendarEventInput: Pick<
    GoogleCalendarInviteDispatchInput,
    | "organizer"
    | "lead"
    | "sdrEmail"
    | "meetingDate"
    | "meetingNotes"
    | "meetingLink"
    | "extraGuests"
    | "existingEventId"
    | "durationMinutes"
    | "transfer"
  >;
}

export type DispatchMeetingInvitationSuccess = {
  ok: true;
  calendarResult: CalendarEventResult | null;
  calendarSyncWarning: string | null;
  googleDispatchError: string | null;
  resolvedMeetingLink: string | null;
  inviteDispatchStatus: InviteDispatchStatus;
  inviteDispatchProvider: InviteDispatchProvider;
  inviteDispatchFallbackUsed: boolean;
  inviteDispatchLastError: string | null;
  inviteDispatchLastPayload: Prisma.InputJsonValue | null;
  activityEvents: InviteDispatchActivityEvent[];
  googleCalendarLogEvents: GoogleCalendarLogEvent[];
};

export type DispatchMeetingInvitationFailure = {
  ok: false;
  errorMessage: string;
  activityEvents: InviteDispatchActivityEvent[];
  googleCalendarLogEvents: GoogleCalendarLogEvent[];
};

export type DispatchMeetingInvitationResult =
  | DispatchMeetingInvitationSuccess
  | DispatchMeetingInvitationFailure;

export interface IMeetingInvitationDispatcher {
  dispatch(input: DispatchMeetingInvitationInput): Promise<DispatchMeetingInvitationResult>;
}
