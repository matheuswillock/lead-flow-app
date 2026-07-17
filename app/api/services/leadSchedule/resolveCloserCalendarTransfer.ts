export type CloserCalendarTransferInput = {
  closerId: string;
  leadCurrentCloserId: string | null;
  existingGoogleEventId?: string | null;
  existingMeetingLink?: string | null;
  leadMeetingLink?: string | null;
  requestMeetingLink?: string | null;
};

export type CloserCalendarTransferPlan = {
  /** Cancelar evento no Calendar do closer antigo e criar novo no closer atual. */
  shouldTransferCalendarOwnership: boolean;
  previousCloserId: string | null;
  previousEventId: string | null;
  /** Link a enviar ao upsert (preserva Meet na troca de closer). */
  meetingLinkForUpsert: string | null;
  /** null na troca de closer — evento novo no Calendar do closer atual. */
  existingEventIdForUpsert: string | null;
};

function trimOrNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Planeja o upsert no Google Calendar quando o closer muda em um agendamento
 * que já tem evento/Meet: cancelar no antigo + criar no novo com o mesmo Meet.
 */
export function resolveCloserCalendarTransfer(
  input: CloserCalendarTransferInput
): CloserCalendarTransferPlan {
  const closerChanged =
    input.leadCurrentCloserId != null && input.closerId !== input.leadCurrentCloserId;
  const previousEventId = trimOrNull(input.existingGoogleEventId);
  const shouldTransferCalendarOwnership = closerChanged && Boolean(previousEventId);

  const preservedMeetLink =
    trimOrNull(input.requestMeetingLink) ??
    trimOrNull(input.existingMeetingLink) ??
    trimOrNull(input.leadMeetingLink);

  if (closerChanged) {
    return {
      shouldTransferCalendarOwnership,
      previousCloserId: shouldTransferCalendarOwnership ? input.leadCurrentCloserId : null,
      previousEventId: shouldTransferCalendarOwnership ? previousEventId : null,
      meetingLinkForUpsert: preservedMeetLink,
      existingEventIdForUpsert: null,
    };
  }

  return {
    shouldTransferCalendarOwnership: false,
    previousCloserId: null,
    previousEventId: null,
    meetingLinkForUpsert: trimOrNull(input.requestMeetingLink),
    existingEventIdForUpsert: previousEventId,
  };
}
