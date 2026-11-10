import { DEFAULT_TZ } from "@/lib/dates/DEFAULT_TZ";
import { formatLocalInputValue, parseLocalToUtc } from "@/lib/dates/parse";

/**
 * Parseia data/hora em pt-BR para ISO, no fuso da conta do usuário (padrão: Brasília).
 * Aceita: "15/07/2026 14:30", com título e/ou link opcionais após `|`:
 * "15/07/2026 14:30 | Visita técnica | https://meet.example.com/abc"
 */
export type ParsedMeetingInput = {
  isoDate: string;
  title: string | null;
  meetingLink: string | null;
};

function isHttpLink(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

const pad = (value: number, size = 2) => String(value).padStart(size, "0");

export function parseMeetingDatetimeInput(raw: string, timezone: string = DEFAULT_TZ): ParsedMeetingInput | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const [datetimePart, ...extraParts] = trimmed.split("|");
  const extras = extraParts.map((part) => part.trim()).filter(Boolean);
  const meetingLink = extras.find(isHttpLink) ?? null;
  const title = extras.find((part) => !isHttpLink(part)) ?? null;

  const match = datetimePart
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    year < 2000
  ) {
    return null;
  }

  const localIso = `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
  const date = parseLocalToUtc(localIso, timezone);
  if (Number.isNaN(date.getTime())) return null;

  // Rejeita datas inexistentes (ex.: 31/02): ao voltar para o horário local, o dia mudaria.
  if (formatLocalInputValue(date, timezone) !== localIso) return null;

  return { isoDate: date.toISOString(), title, meetingLink };
}
