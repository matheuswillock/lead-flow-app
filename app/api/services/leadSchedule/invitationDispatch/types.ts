import type { InviteDispatchStatus, Prisma } from "@prisma/client";

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E3 — tipos compartilhados entre
 * `LeadScheduleService`, `IGoogleCalendarInviteStrategy`,
 * `IResendIcsInviteStrategy` e `IMeetingInvitationDispatcher`. Movido de
 * dentro de `LeadScheduleService.ts` (onde era um tipo local) para não
 * duplicar a forma do resultado do Google Calendar.
 */
export type CalendarEventResult = {
  eventId: string;
  calendarId: string;
  htmlLink?: string | null;
  meetLink?: string | null;
};

export type InviteDispatchProvider = "google" | "resend";

export type InviteDispatchPublicResult = {
  status: InviteDispatchStatus;
  provider: InviteDispatchProvider;
  fallbackUsed: boolean;
  attemptedAt: string;
  error: string | null;
};

/**
 * Um evento de disparo já pronto para virar atividade (`LeadActivity`) — o
 * despachante não grava no banco (T-13.7: sem prisma); ele só descreve o que
 * aconteceu, e quem grava é o chamador, que já tem essa responsabilidade
 * hoje (`registerInviteDispatchActivity`, dentro de `LeadScheduleService.ts`).
 */
export type InviteDispatchActivityEvent = {
  provider: InviteDispatchProvider;
  status: InviteDispatchStatus;
  fallbackUsed: boolean;
  recipients: string[];
  error: string | null;
  metadata: Prisma.InputJsonValue | null;
};

/** Idem, para o log de disparo via Google Calendar (`logGoogleCalendarDispatchesForRecipients`). */
export type GoogleCalendarLogEvent = {
  recipients: string[];
  subject: string;
  sourceId: string;
  success: boolean;
  errorMessage?: string | null;
};
