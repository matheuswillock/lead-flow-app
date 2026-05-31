import { getCalendarBusyIntervals } from "@/app/api/services/googleCalendar/GoogleCalendarService";
import {
  CalendarAvailabilityServiceError,
  type CalendarAvailabilityResult,
  type GetCalendarAvailabilityInput,
  type ICalendarAvailabilityService,
} from "./ICalendarAvailabilityService";
import {
  calendarAvailabilityRepository,
} from "@/app/api/infra/data/repositories/calendarAvailability/CalendarAvailabilityRepository";
import type { ICalendarAvailabilityRepository } from "@/app/api/infra/data/repositories/calendarAvailability/ICalendarAvailabilityRepository";
import { DEFAULT_TZ, formatLocalDateValue, getDayRangeInTz, getMinutesInTz, resolveTimezone } from "@/lib/dates";

const SLOT_MINUTES = 30;

const formatTimeSlot = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const sortTimeSlots = (a: string, b: string) => {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return ah * 60 + am - (bh * 60 + bm);
};

const isExpectedGoogleFallbackError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("conta google nao conectada") ||
    message.includes("conexao invalida") ||
    message.includes("refresh token ausente")
  );
};

export class CalendarAvailabilityService implements ICalendarAvailabilityService {
  constructor(private readonly repository: ICalendarAvailabilityRepository) {}

  async getAvailability(input: GetCalendarAvailabilityInput): Promise<CalendarAvailabilityResult> {
    const { teamId, requestedCloserIds, date, excludeLeadId } = input;
    const timezone = resolveTimezone(input.userTimezone ?? DEFAULT_TZ);

    const memberProfileIds = await this.repository.findTeamMemberProfileIds(teamId, requestedCloserIds);
    if (memberProfileIds.length !== requestedCloserIds.length) {
      throw new CalendarAvailabilityServiceError(
        "CLOSERS_NOT_IN_TEAM",
        "Um ou mais closers não pertencem ao time informado."
      );
    }

    const closerProfiles = await this.repository.findCloserProfiles(requestedCloserIds);
    if (closerProfiles.length === 0) {
      throw new CalendarAvailabilityServiceError("CLOSERS_NOT_FOUND", "Closers não encontrados.");
    }

    const excludedLead = excludeLeadId
      ? await this.repository.findExcludedLead(excludeLeadId, teamId)
      : null;

    const preservedSlotByCloser = new Map<string, string>();
    if (excludedLead?.closerId && excludedLead.meetingDate) {
      const excludedDateKey = formatLocalDateValue(excludedLead.meetingDate, timezone);
      if (excludedDateKey === date) {
        preservedSlotByCloser.set(
          excludedLead.closerId,
          formatTimeSlot(getMinutesInTz(excludedLead.meetingDate, timezone))
        );
      }
    }

    const { start: dayStart, end: dayEnd } = getDayRangeInTz(date, timezone);
    const timeMin = dayStart.toISOString();
    const timeMax = dayEnd.toISOString();

    const internalLeads = await this.repository.findScheduledLeadsForDay({
      teamId,
      requestedCloserIds,
      dayStart,
      dayEnd,
    });

    const internalBusyByCloser = internalLeads.reduce<Record<string, Array<{ start: string; end: string }>>>(
      (acc, lead) => {
        if (!lead.meetingDate || !lead.closerId) return acc;
        const start = lead.meetingDate as Date;
        const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
        acc[lead.closerId] = acc[lead.closerId] || [];
        acc[lead.closerId].push({ start: start.toISOString(), end: end.toISOString() });
        return acc;
      },
      {}
    );

    const now = new Date();
    const todayKey = formatLocalDateValue(now, timezone);
    const isToday = date === todayKey;
    const nowMinutes = getMinutesInTz(now, timezone);

    const slots = Array.from({ length: 24 * (60 / SLOT_MINUTES) }, (_, index) => index * SLOT_MINUTES);

    const computeAvailability = (busyIntervals: Array<{ start: string; end: string }>) => {
      return slots
        .filter((slotStart) => {
          if (isToday && slotStart < nowMinutes) {
            return false;
          }

          const slotEnd = slotStart + SLOT_MINUTES;

          return !busyIntervals.some((interval) => {
            const startDate = new Date(interval.start);
            const endDate = new Date(interval.end);
            if (endDate <= now) return false;
            if (endDate <= dayStart || startDate >= dayEnd) return false;

            const startClamp = startDate < dayStart ? dayStart : startDate;
            const endClamp = endDate > dayEnd ? dayEnd : endDate;

            const busyStart = getMinutesInTz(startClamp, timezone);
            const busyEnd = getMinutesInTz(endClamp, timezone);

            return slotStart < busyEnd && slotEnd > busyStart;
          });
        })
        .map(formatTimeSlot);
    };

    const perCloser: Record<string, string[]> = {};
    let source: "google" | "internal" = "internal";

    for (const closerProfile of closerProfiles) {
      const canUseGoogleCalendar =
        !!closerProfile.googleCalendarConnected && !!closerProfile.googleRefreshToken;
      let busyIntervals: Array<{ start: string; end: string }> = [];
      let usedGoogle = false;

      if (canUseGoogleCalendar) {
        try {
          if (!closerProfile.googleConnection) {
            throw new Error("Perfil marcado com Google conectado, mas sem conexao OAuth carregada");
          }

          busyIntervals = await getCalendarBusyIntervals({
            organizer: {
              profileId: closerProfile.id,
              supabaseId: closerProfile.supabaseId,
              timezone: closerProfile.timezone ?? timezone,
              connection: closerProfile.googleConnection,
            },
            timeMin,
            timeMax,
          });
          usedGoogle = true;
        } catch (error) {
          const reason = isExpectedGoogleFallbackError(error)
            ? "google_connection_unavailable"
            : "google_availability_unavailable";
          console.info(
            `Google Calendar indisponivel para disponibilidade (${reason}); usando fallback interno.`
          );
        }
      }

      if (!usedGoogle) {
        busyIntervals = internalBusyByCloser[closerProfile.id] ?? [];
      }

      const closerAvailability = computeAvailability(busyIntervals);
      const preservedSlot = preservedSlotByCloser.get(closerProfile.id);
      if (preservedSlot && !closerAvailability.includes(preservedSlot)) {
        closerAvailability.push(preservedSlot);
        closerAvailability.sort(sortTimeSlots);
      }

      perCloser[closerProfile.id] = closerAvailability;
      if (usedGoogle) {
        source = "google";
      }
    }

    const availableTimes = Array.from(new Set(Object.values(perCloser).flat())).sort(sortTimeSlots);

    return {
      availableTimes,
      source,
      perCloser,
    };
  }
}

export const calendarAvailabilityService: ICalendarAvailabilityService =
  new CalendarAvailabilityService(calendarAvailabilityRepository);
