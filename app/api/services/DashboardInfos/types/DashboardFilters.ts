export type DashboardFilters = {
  supabaseId: string;
  teamId: string;
  startDate?: Date;
  endDate?: Date;
  period?: '7d' | '30d' | '3m' | '6m' | '1y';
};
