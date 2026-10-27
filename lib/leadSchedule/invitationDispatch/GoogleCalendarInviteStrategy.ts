import {
  cancelCalendarEvent,
  upsertCalendarEvent,
} from "@/app/api/services/googleCalendar/GoogleCalendarService";
import type {
  GoogleCalendarInviteDispatchInput,
  IGoogleCalendarInviteStrategy,
} from "@/app/api/services/leadSchedule/invitationDispatch/IGoogleCalendarInviteStrategy";
import type { CalendarEventResult } from "@/app/api/services/leadSchedule/invitationDispatch/types";

const LOG_PREFIX = "[GoogleCalendarInviteStrategy]";

type UpsertCalendarEventOrganizer = Parameters<typeof upsertCalendarEvent>[0]["organizer"];
type UpsertCalendarEventLead = Parameters<typeof upsertCalendarEvent>[0]["lead"];

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E3 — adaptador concreto de
 * `IGoogleCalendarInviteStrategy`. Vive em `lib/` (não em
 * `app/api/services/**`) de propósito: é o único lugar que precisa mesmo
 * importar `GoogleCalendarService`, e `lib/` é onde este repositório já
 * coloca adaptadores de infraestrutura equivalentes (ex.: `lib/services/
 * EmailService.ts`) — fora do escopo da regra de governança "Service só é
 * chamado por UseCase", que vale para `app/api/services/**`.
 *
 * Extração pura de `attemptCloserCalendarUpsert` (closure que vivia dentro
 * de `LeadScheduleService.createSchedule`). Mesmo comportamento: cria/
 * atualiza o evento no Calendar do closer atual e, só depois de confirmado o
 * sucesso (para não deixar a reunião sem convite se o cancelamento falhar
 * primeiro), cancela — best-effort — o evento do closer anterior quando há
 * troca.
 */
export class GoogleCalendarInviteStrategy implements IGoogleCalendarInviteStrategy {
  async dispatch(input: GoogleCalendarInviteDispatchInput): Promise<CalendarEventResult> {
    const result = await upsertCalendarEvent({
      organizer: input.organizer as UpsertCalendarEventOrganizer,
      lead: input.lead as UpsertCalendarEventLead,
      closerEmail: input.closerEmail,
      sdrEmail: input.sdrEmail,
      meetingDate: input.meetingDate,
      meetingTitle: input.meetingTitle,
      notes: input.meetingNotes,
      meetingLink: input.meetingLink,
      meetingFormatLabel: input.meetingFormatLabel ?? null,
      extraGuests: input.extraGuests,
      attendeeEmails: input.attendeeEmails,
      existingEventId: input.existingEventId,
      durationMinutes: input.durationMinutes,
    });

    const transfer = input.transfer;
    if (transfer?.shouldTransfer && transfer.previousEventId) {
      if (transfer.previousOrganizer) {
        try {
          await cancelCalendarEvent({
            organizer: transfer.previousOrganizer as UpsertCalendarEventOrganizer,
            eventId: transfer.previousEventId,
            calendarId: transfer.previousCalendarId,
          });
          console.info(`${LOG_PREFIX} Evento cancelado no Calendar do closer anterior`, {
            leadId: transfer.leadId,
            previousCloserId: transfer.previousCloserId,
            previousEventId: transfer.previousEventId,
            newCloserId: transfer.newCloserId,
            newEventId: result.eventId,
          });
        } catch (cancelPreviousError) {
          console.warn(
            `${LOG_PREFIX} Falha ao cancelar evento no Calendar do closer anterior após criar o novo`,
            {
              leadId: transfer.leadId,
              previousCloserId: transfer.previousCloserId,
              previousEventId: transfer.previousEventId,
              newEventId: result.eventId,
              error:
                cancelPreviousError instanceof Error
                  ? cancelPreviousError.message
                  : String(cancelPreviousError),
            }
          );
        }
      } else {
        console.warn(
          `${LOG_PREFIX} Closer anterior sem Google conectado; evento antigo pode ficar órfão`,
          {
            leadId: transfer.leadId,
            previousCloserId: transfer.previousCloserId,
            previousEventId: transfer.previousEventId,
          }
        );
      }
    }

    return result;
  }
}

export const googleCalendarInviteStrategy = new GoogleCalendarInviteStrategy();
