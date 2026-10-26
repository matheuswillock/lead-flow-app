import type { LeadStatus, Prisma } from "@prisma/client";

/**
 * Status em que a reunião de um lead já não ocupa a agenda do closer.
 * Mesma lista que o calendário usa para não gerar eventos de lead time.
 */
export const MEETING_TERMINAL_LEAD_STATUSES: LeadStatus[] = [
  "contract_finalized",
  "opportunityLost",
  "disqualified",
  "operator_denied",
];

/**
 * Reunião de lead que ocupa o horário do closer (SPEC 13/14, DA3): qualquer lead não deletado em
 * status NÃO terminal, e não só `scheduled`. Isso inclui `no_show` com reunião futura e os leads em
 * `new_opportunity` que já nasceram com `meetingDate` (formulário público, D26).
 *
 * Compartilhado por `CalendarAvailabilityRepository` (o que a API mostra como livre) e por
 * `TeamMeetingSlotReservationRepository.reserve` (o que a criação aceita): se divergirem, o que a
 * API oferece como livre a reserva recusa.
 */
export const MEETING_OCCUPANCY_LEAD_WHERE: Prisma.LeadWhereInput = {
  deletedAt: null,
  status: { notIn: MEETING_TERMINAL_LEAD_STATUSES },
};
