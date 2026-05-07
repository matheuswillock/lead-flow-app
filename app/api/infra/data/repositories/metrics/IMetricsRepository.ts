import { LeadStatus, MeetingHeald } from "@prisma/client";

export interface LeadMetricsData {
  id: string;
  status: LeadStatus;
  currentValue: any; // Prisma Decimal type
  ticket: any; // Prisma Decimal type
  createdAt: Date;
  statusEnteredAt: Date | null;
  meetingDate: Date | null;
  meetingHeald: MeetingHeald | null;
  assignedTo: string | null;
  closerId: string | null;
}

export interface StatusMetricsData {
  status: LeadStatus;
  _count: {
    id: number;
  };
  _avg: {
    currentValue: any; // Prisma Decimal type
  };
  _sum: {
    currentValue: any; // Prisma Decimal type
  };
}

export interface LeadsPeriodData {
  createdAt: Date;
  _count: {
    id: number;
  };
}

export interface MetricsFilters {
  supabaseId: string;
  teamId: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ScheduleMetricsData {
  id: string;
  leadId: string;
  date: Date;
  createdAt: Date;
}

export interface ScheduledLeadIdData {
  leadId: string;
}

export interface MeetingHeldLeadMetricsData {
  meetingDate: Date | null;
  assignedTo: string | null;
  closerId: string | null;
}

export interface SaleMetricsData {
  id: string;
  leadId: string;
  amount: any; // Prisma Decimal type
  finalizedDateAt: Date;
  lead: {
    createdAt: Date;
  };
}

export interface TeamContext {
  profileId: string;
  userTimezone?: string;
  teamMember: {
    role: string;
    functions: string[];
  };
}

export interface MetricsFiltersWithContext extends MetricsFilters {
  ctx: TeamContext;
}

export interface IMetricsRepository {
  /**
   * Resolve profileId e role do usuário — deve ser chamado uma única vez por request.
   */
  resolveTeamContext(supabaseId: string, teamId: string): Promise<TeamContext>;

  /**
   * Busca leads básicos para cálculo de métricas
   */
  findLeadsForMetrics(filters: MetricsFilters): Promise<LeadMetricsData[]>;

  /**
   * Busca leads básicos para cálculo de métricas com contexto já resolvido (evita re-query)
   */
  findLeadsForMetricsWithCtx(filters: MetricsFiltersWithContext): Promise<LeadMetricsData[]>;

  /**
   * Busca métricas detalhadas por status
   */
  getStatusMetrics(supabaseId: string, teamId: string): Promise<StatusMetricsData[]>;

  /**
   * Busca métricas detalhadas por status com contexto já resolvido
   */
  getStatusMetricsWithCtx(ctx: TeamContext, teamId: string): Promise<StatusMetricsData[]>;

  /**
   * Busca leads agrupados por período
   */
  getLeadsByPeriod(supabaseId: string, teamId: string, startDate: Date, endDate: Date): Promise<LeadsPeriodData[]>;

  /**
   * Busca leads agrupados por período com contexto já resolvido
   */
  getLeadsByPeriodWithCtx(ctx: TeamContext, teamId: string, startDate: Date, endDate: Date): Promise<LeadsPeriodData[]>;

  /**
   * Busca agendamentos da tabela LeadsSchedule
   */
  getScheduledLeads(filters: MetricsFilters): Promise<ScheduleMetricsData[]>;

  /**
   * Busca agendamentos com contexto já resolvido
   */
  getScheduledLeadsWithCtx(filters: MetricsFiltersWithContext): Promise<ScheduleMetricsData[]>;

  /**
   * Busca IDs de leads com meetingDate no período com contexto já resolvido
   */
  getLeadsWithMeetingDateWithCtx(filters: MetricsFiltersWithContext): Promise<ScheduledLeadIdData[]>;

  /**
   * Busca vendas finalizadas da tabela LeadFinalized
   */
  getFinalizedLeads(filters: MetricsFilters): Promise<SaleMetricsData[]>;

  /**
   * Busca vendas finalizadas com contexto já resolvido
   */
  getFinalizedLeadsWithCtx(filters: MetricsFiltersWithContext): Promise<SaleMetricsData[]>;

  /**
   * Busca reuniões realizadas (meetingHeald = yes) por período (meetingDate)
   */
  getMeetingsHeldLeads(filters: MetricsFilters): Promise<MeetingHeldLeadMetricsData[]>;

  /**
   * Busca reuniões realizadas com contexto já resolvido
   */
  getMeetingsHeldLeadsWithCtx(filters: MetricsFiltersWithContext): Promise<MeetingHeldLeadMetricsData[]>;
}
