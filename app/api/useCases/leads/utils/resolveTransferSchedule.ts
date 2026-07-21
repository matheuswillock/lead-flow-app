export type TransferScheduleLead = {
  meetingDate?: Date | string | null;
  meetingTitle?: string | null;
  meetingNotes?: string | null;
  meetingType?: string | null;
  email?: string | null;
};

export type ExistingPreSchedule = {
  meetingType?: string | null;
  notes?: string | null;
  extraGuests?: string[];
  googleEventId?: string | null;
} | null;

export type TransferScheduleRequest = {
  date?: string;
  meetingTitle?: string;
  meetingNotes?: string;
  meetingType?: "online" | "call" | "whatsapp";
  extraGuests?: string[];
  meetingLink?: string;
  transitionStatusToScheduled?: boolean;
};

export type ResolvedTransferSchedule = {
  meetingDateIso: string;
  meetingTitle: string;
  meetingNotes?: string;
  meetingType: "online" | "call" | "whatsapp";
  extraGuests?: string[];
  transitionStatusToScheduled: boolean;
  meetingLink?: string;
};

const MEETING_TYPES = new Set(["online", "call", "whatsapp"]);

function resolveMeetingType(
  scheduleType: TransferScheduleRequest["meetingType"],
  existingPreSchedule: ExistingPreSchedule,
  lead: TransferScheduleLead
): "online" | "call" | "whatsapp" {
  if (scheduleType && MEETING_TYPES.has(scheduleType)) {
    return scheduleType;
  }
  if (
    existingPreSchedule?.meetingType &&
    MEETING_TYPES.has(existingPreSchedule.meetingType)
  ) {
    return existingPreSchedule.meetingType as "online" | "call" | "whatsapp";
  }
  if (lead.meetingType && MEETING_TYPES.has(lead.meetingType)) {
    return lead.meetingType as "online" | "call" | "whatsapp";
  }
  return "online";
}

export function isScheduleReschedule(existingPreSchedule: ExistingPreSchedule): boolean {
  return !!(existingPreSchedule?.googleEventId);
}

export function resolveTransferScheduleInput(
  schedule: TransferScheduleRequest,
  lead: TransferScheduleLead,
  existingPreSchedule: ExistingPreSchedule
): { ok: true; value: ResolvedTransferSchedule } | { ok: false; error: string } {
  const meetingType = resolveMeetingType(schedule.meetingType, existingPreSchedule, lead);
  const leadMeetingDate =
    lead.meetingDate instanceof Date
      ? lead.meetingDate.toISOString()
      : lead.meetingDate
        ? new Date(lead.meetingDate).toISOString()
        : undefined;
  const meetingDateIso = schedule.date ?? leadMeetingDate;

  if (!meetingDateIso) {
    return { ok: false, error: "Data do agendamento é obrigatória para transferir com reunião." };
  }

  if (meetingType === "online" && !lead.email?.trim()) {
    return {
      ok: false,
      error: "Lead precisa de e-mail para agendamento online na transferência.",
    };
  }

  const resolvedExtraGuests =
    schedule.extraGuests && schedule.extraGuests.length > 0
      ? schedule.extraGuests
      : (existingPreSchedule?.extraGuests ?? []);

  return {
    ok: true,
    value: {
      meetingDateIso,
      meetingTitle:
        schedule.meetingTitle?.trim() ||
        lead.meetingTitle?.trim() ||
        "",
      meetingNotes:
        schedule.meetingNotes ??
        existingPreSchedule?.notes ??
        lead.meetingNotes ??
        undefined,
      meetingType,
      extraGuests: resolvedExtraGuests.length > 0 ? resolvedExtraGuests : undefined,
      transitionStatusToScheduled: schedule.transitionStatusToScheduled ?? true,
      meetingLink: schedule.meetingLink,
    },
  };
}
