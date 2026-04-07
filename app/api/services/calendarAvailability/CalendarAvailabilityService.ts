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

const SLOT_MINUTES = 30;
const TIMEZONE = "America/Sao_Paulo";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const getMinutesInDay = (date: Date) => {
  const parts = timeFormatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
};

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

export class CalendarAvailabilityService implements ICalendarAvailabilityService {
  constructor(private readonly repository: ICalendarAvailabilityRepository) {}

  async getAvailability(input: GetCalendarAvailabilityInput): Promise<CalendarAvailabilityResult> {
    const { teamId, requestedCloserIds, date, excludeLeadId } = input;

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
      const excludedDateKey = dateFormatter.format(excludedLead.meetingDate);
      if (excludedDateKey === date) {
        preservedSlotByCloser.set(
          excludedLead.closerId,
          formatTimeSlot(getMinutesInDay(excludedLead.meetingDate))
        );
      }
    }

    const dayStart = new Date(`${date}T00:00:00-03:00`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const timeMin = `${date}T00:00:00-03:00`;
    const timeMax = `${date}T23:59:59-03:00`;

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
    const todayKey = dateFormatter.format(now);
    const isToday = date === todayKey;
    const nowMinutes = getMinutesInDay(now);

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

            const busyStart = getMinutesInDay(startClamp);
            const busyEnd = getMinutesInDay(endClamp);

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
          busyIntervals = await getCalendarBusyIntervals({
            organizer: closerProfile as unknown as Parameters<typeof getCalendarBusyIntervals>[0]["organizer"],
            timeMin,
            timeMax,
          });
          usedGoogle = true;
        } catch (error) {
          console.warn(
            "Falha ao buscar disponibilidade no Google Calendar, usando fallback interno.",
            error
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
