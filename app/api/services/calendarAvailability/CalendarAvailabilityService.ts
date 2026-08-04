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
import {
  DEFAULT_TZ,
  addDaysInTz,
  formatLocalDateValue,
  getBusyMinutesRangeInDay,
  getDayRangeInTz,
  getMinutesInTz,
  resolveTimezone,
} from "@/lib/dates";

const SLOT_MINUTES = 30;
const MAX_RANGE_DAYS = 60;

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

type DayWindow = { dateKey: string; start: Date; end: Date };

export class CalendarAvailabilityService implements ICalendarAvailabilityService {
  constructor(private readonly repository: ICalendarAvailabilityRepository) {}

  async getAvailability(input: GetCalendarAvailabilityInput): Promise<CalendarAvailabilityResult> {
    const { teamId, requestedCloserIds, date, excludeLeadId, excludeLeadTeamId } = input;
    const timezone = resolveTimezone(input.userTimezone ?? DEFAULT_TZ);
    const rangeDays = Math.min(Math.max(input.days ?? 1, 1), MAX_RANGE_DAYS);

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

    const dayWindows: DayWindow[] = [];
    let cursor = getDayRangeInTz(date, timezone);
    for (let index = 0; index < rangeDays; index += 1) {
      dayWindows.push({
        dateKey: formatLocalDateValue(cursor.start, timezone),
        start: cursor.start,
        end: cursor.end,
      });
      cursor = { start: cursor.end, end: addDaysInTz(cursor.end, 1, timezone) };
    }

    const rangeStart = dayWindows[0].start;
    const rangeEnd = dayWindows[dayWindows.length - 1].end;
    const dayWindowByKey = new Map(dayWindows.map((window) => [window.dateKey, window]));

    const excludedLead = excludeLeadId
      ? await this.repository.findExcludedLead(excludeLeadId, excludeLeadTeamId ?? teamId)
      : null;

    const preservedSlotByCloser = new Map<string, { dateKey: string; slot: string }>();
    if (excludedLead?.closerId && excludedLead.meetingDate) {
      const excludedDateKey = formatLocalDateValue(excludedLead.meetingDate, timezone);
      if (dayWindowByKey.has(excludedDateKey)) {
        preservedSlotByCloser.set(excludedLead.closerId, {
          dateKey: excludedDateKey,
          slot: formatTimeSlot(getMinutesInTz(excludedLead.meetingDate, timezone)),
        });
      }
    }

    const timeMin = rangeStart.toISOString();
    const timeMax = rangeEnd.toISOString();

    const internalLeads = await this.repository.findScheduledLeadsForDay({
      teamId,
      requestedCloserIds,
      dayStart: rangeStart,
      dayEnd: rangeEnd,
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
    const nowMinutes = getMinutesInTz(now, timezone);

    const slots = Array.from({ length: 24 * (60 / SLOT_MINUTES) }, (_, index) => index * SLOT_MINUTES);

    const computeAvailability = (
      busyIntervals: Array<{ start: string; end: string }>,
      dayWindow: DayWindow
    ) => {
      const isToday = dayWindow.dateKey === todayKey;

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

            const busyRange = getBusyMinutesRangeInDay(
              { start: startDate, end: endDate },
              { start: dayWindow.start, end: dayWindow.end },
              timezone
            );
            if (!busyRange) return false;

            return slotStart < busyRange.endMinutes && slotEnd > busyRange.startMinutes;
          });
        })
        .map(formatTimeSlot);
    };

    // Consultas ao Google em paralelo (antes eram seriais por closer);
    // falhas caem no fallback interno individualmente.
    const busyByCloser = await Promise.all(
      closerProfiles.map(async (closerProfile) => {
        const canUseGoogleCalendar =
          !!closerProfile.googleCalendarConnected && !!closerProfile.googleRefreshToken;

        if (canUseGoogleCalendar) {
          try {
            if (!closerProfile.googleConnection) {
              throw new Error("Perfil marcado com Google conectado, mas sem conexao OAuth carregada");
            }

            const busyIntervals = await getCalendarBusyIntervals({
              organizer: {
                profileId: closerProfile.id,
                supabaseId: closerProfile.supabaseId,
                timezone: closerProfile.timezone ?? timezone,
                connection: closerProfile.googleConnection,
              },
              timeMin,
              timeMax,
            });
            return { closerProfile, busyIntervals, usedGoogle: true };
          } catch (error) {
            const reason = isExpectedGoogleFallbackError(error)
              ? "google_connection_unavailable"
              : "google_availability_unavailable";
            console.info(
              `Google Calendar indisponivel para disponibilidade (${reason}); usando fallback interno.`
            );
          }
        }

        return {
          closerProfile,
          busyIntervals: internalBusyByCloser[closerProfile.id] ?? [],
          usedGoogle: false,
        };
      })
    );

    const perCloser: Record<string, string[]> = {};
    const days: Record<string, string[]> = {};
    let source: "google" | "internal" = "internal";

    for (const window of dayWindows) {
      const daySlots = new Set<string>();

      for (const { closerProfile, busyIntervals, usedGoogle } of busyByCloser) {
        const closerAvailability = computeAvailability(busyIntervals, window);
        const preserved = preservedSlotByCloser.get(closerProfile.id);
        if (
          preserved &&
          preserved.dateKey === window.dateKey &&
          !closerAvailability.includes(preserved.slot)
        ) {
          closerAvailability.push(preserved.slot);
          closerAvailability.sort(sortTimeSlots);
        }

        if (window.dateKey === date) {
          perCloser[closerProfile.id] = closerAvailability;
          if (usedGoogle) {
            source = "google";
          }
        }

        for (const slot of closerAvailability) {
          daySlots.add(slot);
        }
      }

      days[window.dateKey] = Array.from(daySlots).sort(sortTimeSlots);
    }

    const availableTimes = Array.from(new Set(Object.values(perCloser).flat())).sort(sortTimeSlots);

    return {
      availableTimes,
      source,
      perCloser,
      days,
    };
  }
}

export const calendarAvailabilityService: ICalendarAvailabilityService =
  new CalendarAvailabilityService(calendarAvailabilityRepository);
