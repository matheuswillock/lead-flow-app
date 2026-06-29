export interface PerformanceMeetingsHeldFilters {
  teamId: string;
  startDate: Date;
  endDate: Date;
  sdrId?: string;
  closerId?: string;
  page: number;
  pageSize: number;
  countMonth?: string;
  userTimezone: string;
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

export interface PerformanceMeetingsHeldResult {
  rows: MeetingHeldRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  dayCounts: Record<string, number>;
}

export interface IPerformanceMeetingsHeldService {
  getMeetingsHeld(filters: PerformanceMeetingsHeldFilters): Promise<PerformanceMeetingsHeldResult>;
}
