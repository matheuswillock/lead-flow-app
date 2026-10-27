import type { CalendarEventResult } from "./types";

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E3 — porta para o serviço do Google
 * usado por `createSchedule`. Extração pura de `attemptCloserCalendarUpsert`
 * (closure interna de `LeadScheduleService.createSchedule`): mesmo
 * comportamento (upsert do evento + cancelamento best-effort do evento do
 * closer anterior quando há troca), só atrás de uma interface para o
 * despachante ser testável sem chamar o Google de verdade (T-13.7).
 *
 * `organizer`/`lead` são `unknown` de propósito: a porta não precisa (nem
 * deve) conhecer o formato exato que `upsertCalendarEvent` exige — isso é
 * detalhe do adaptador concreto (`lib/leadSchedule/invitationDispatch/
 * GoogleCalendarInviteStrategy.ts`, que importa o tipo real do serviço do
 * Google). Manter esse import fora de `app/api/services/**` evita que o
 * ADAPTADOR concreto (que precisa mesmo chamar o serviço do Google) vire uma
 * segunda instância do débito "Service importando Service" que
 * `LeadScheduleService.ts` já carrega (DA9) — o objetivo de A-E3 é encapsular
 * esse acoplamento, não duplicá-lo.
 */
export interface GoogleCalendarInviteDispatchInput {
  organizer: unknown;
  lead: unknown;
  closerEmail?: string | null;
  sdrEmail?: string | null;
  meetingDate: Date;
  meetingTitle?: string | null;
  meetingNotes?: string | null;
  meetingLink?: string | null;
  meetingFormatLabel?: string | null;
  extraGuests?: string[];
  attendeeEmails: string[];
  existingEventId?: string | null;
  durationMinutes?: number;
  /**
   * Presente só quando há troca de closer com evento existente no Google
   * (`resolveCloserCalendarTransfer`). `previousOrganizer` já vem resolvido
   * pelo chamador (que já faz a leitura de perfil via Prisma hoje) — a
   * estratégia não lê banco, só decide se cancela ou não e loga o resultado.
   */
  transfer?: {
    shouldTransfer: boolean;
    previousOrganizer: unknown;
    previousEventId: string | null;
    previousCalendarId: string;
    /** Só para os logs terem o mesmo contexto que tinham antes da extração. */
    leadId: string;
    previousCloserId: string | null;
    newCloserId: string;
  };
}

export interface IGoogleCalendarInviteStrategy {
  /**
   * Cria/atualiza o evento no Calendar do closer atual e, quando aplicável,
   * cancela o evento do closer anterior (best-effort — falha no cancelamento
   * não derruba o resultado, só loga um aviso, igual o código original).
   */
  dispatch(input: GoogleCalendarInviteDispatchInput): Promise<CalendarEventResult>;
}
