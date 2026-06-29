export interface MeetingsHeldFiltersState {
  startDate: string;
  endDate: string;
  sdrId: string;
  closerId: string;
  countMonth: string;
  page: number;
  pageSize: number;
}

export interface MeetingHeldRow {
  leadId: string;
  leadCode: string;
  leadName: string;
  meetingDate: string;
  status: string;
  sdr: { id: string; name: string } | null;
  closer: { id: string; name: string } | null;
}

export interface MeetingsHeldData {
  rows: MeetingHeldRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  dayCounts: Record<string, number>;
}

export function buildDefaultMeetingsHeldFilters(tz: string): MeetingsHeldFiltersState {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 6);

  const toKey = (d: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const day = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${day}`;
  };

  const endKey = toKey(end);
  const month = endKey.slice(0, 7);

  return {
    startDate: toKey(start),
    endDate: endKey,
    sdrId: '',
    closerId: '',
    countMonth: month,
    page: 1,
    pageSize: 20,
  };
}
