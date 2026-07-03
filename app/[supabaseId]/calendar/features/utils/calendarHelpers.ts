export function getCalendarWindowFromMonth(month: Date): { start: Date; end: Date } {
  const monthStart = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1, 0, 0, 0, 0)
  );
  const monthEnd = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  );
  const start = new Date(monthStart);
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(monthEnd);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

export function getCalendarDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}
