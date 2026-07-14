/**
 * Parseia data/hora em pt-BR para ISO (America/Sao_Paulo).
 * Aceita: "15/07/2026 14:30" ou "15/07/2026 14:30 | Título"
 */
export type ParsedMeetingInput = {
  isoDate: string;
  title: string | null;
};

export function parseMeetingDatetimeInput(raw: string): ParsedMeetingInput | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const [datetimePart, ...titleParts] = trimmed.split("|");
  const title = titleParts.join("|").trim() || null;
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

  // Constrói como instante em America/Sao_Paulo via offset fixo -03:00 (sem DST desde 2019).
  const isoLocal = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`;
  const date = new Date(isoLocal);
  if (Number.isNaN(date.getTime())) return null;

  return { isoDate: date.toISOString(), title };
}
