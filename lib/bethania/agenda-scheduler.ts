const DEFAULT_TIMEZONE = "America/Sao_Paulo";

type AgendaSlot = { localDate: string; isDue: boolean };

function validTimezone(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function getLocalAgendaSlot(
  instant: Date,
  timezone: string,
  dueHour: number,
): AgendaSlot {
  if (!Number.isInteger(dueHour) || dueHour < 0 || dueHour > 23) {
    throw new RangeError("dueHour must be an integer between 0 and 23");
  }
  if (!Number.isFinite(instant.getTime())) {
    throw new TypeError("instant must be a valid date");
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: validTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    localDate: `${values.year}-${values.month}-${values.day}`,
    isDue: Number(values.hour) === dueHour && Number(values.minute) === 0,
  };
}