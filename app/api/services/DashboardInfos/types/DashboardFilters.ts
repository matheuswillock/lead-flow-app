export type DashboardFilters = {
  supabaseId: string;
  teamId: string;
  teamIds?: string[];
  startDate?: Date;
  endDate?: Date;
  period?: '7d' | '30d' | '3m' | '6m' | '1y';
  teamScope?: 'active' | 'all';
  masterId?: string;
};
