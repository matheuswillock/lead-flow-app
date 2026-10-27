/**
 * SPEC 13 (Agenda na Criação de Lead), A-E3 — porta para os métodos de
 * e-mail que `createSchedule` usa quando o closer não tem Google conectado
 * (reunião online) ou quando a reunião é por telefone/WhatsApp (aviso ao
 * lead, independente de Google).
 *
 * Os tipos de entrada/saída são redeclarados aqui (mesma forma de
 * `MeetingInviteEmailData`/`MeetingContactNotificationEmailData` em
 * `lib/services/EmailService.ts`) em vez de importados de lá — mesmo motivo
 * de `IGoogleCalendarInviteStrategy`: o adaptador concreto (`lib/leadSchedule/
 * invitationDispatch/ResendIcsInviteStrategy.ts`) é quem precisa conhecer
 * `EmailService` de verdade.
 */
export interface ResendParticipantInviteData {
  to: string[];
  leadName: string;
  meetingTitle?: string | null;
  meetingDate: Date;
  meetingLink?: string | null;
  organizerName: string;
  organizerEmail?: string | null;
  eventUid?: string | null;
  timezone?: string | null;
  teamId?: string;
  sourceType?: string;
  sourceId?: string;
}

export interface ResendContactNotificationData {
  to: string;
  leadName: string;
  meetingDate: Date;
  meetingType: "call" | "whatsapp";
  closerName: string;
  closerPhone?: string | null;
  timezone?: string | null;
  teamId?: string;
  sourceType?: string;
  sourceId?: string;
}

export type ResendDispatchResult =
  | { success: true; data?: unknown }
  | { success: false; error?: string };

export interface IResendIcsInviteStrategy {
  /** Convite por e-mail (com `.ics`) aos participantes sem Google conectado, reunião online. */
  sendParticipantInvite(data: ResendParticipantInviteData): Promise<ResendDispatchResult>;
  /** Aviso ao lead de reunião por telefone/WhatsApp — nunca depende de Google. */
  sendContactNotification(data: ResendContactNotificationData): Promise<ResendDispatchResult>;
}
