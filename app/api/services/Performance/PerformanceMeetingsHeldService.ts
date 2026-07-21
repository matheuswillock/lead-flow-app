import { Prisma } from '@prisma/client';
import { prisma } from '@/app/api/infra/data/prisma';
import { endOfDayInTz, parseDateKeyToUtc, startOfDayInTz } from '@/lib/dates';
import type {
  IPerformanceMeetingsHeldService,
  PerformanceMeetingsHeldFilters,
  PerformanceMeetingsHeldResult,
  MeetingHeldRow,
} from './IPerformanceMeetingsHeldService';

function buildLeadWhere(filters: PerformanceMeetingsHeldFilters): Prisma.LeadWhereInput {
  return {
    teamId: filters.teamId,
    meetingHeald: 'yes',
    meetingDate: { gte: filters.startDate, lte: filters.endDate },
    ...(filters.sdrId ? { assignedTo: filters.sdrId } : {}),
    ...(filters.closerId ? { closerId: filters.closerId } : {}),
  };
}

function resolveCountMonthRange(countMonth: string, tz: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(countMonth);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return null;
  const monthKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  const start = startOfDayInTz(parseDateKeyToUtc(monthKey, tz), tz);
  const lastDay = new Date(year, month, 0).getDate();
  const endKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const end = endOfDayInTz(parseDateKeyToUtc(endKey, tz), tz);
  return { start, end };
}

export class PerformanceMeetingsHeldService implements IPerformanceMeetingsHeldService {
  async getMeetingsHeld(filters: PerformanceMeetingsHeldFilters): Promise<PerformanceMeetingsHeldResult> {
    const where = buildLeadWhere(filters);
    const skip = (filters.page - 1) * filters.pageSize;

    const [totalRows, leads, countRows] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        select: {
          id: true,
          leadCode: true,
          name: true,
          meetingDate: true,
          status: true,
          assignee: { select: { id: true, fullName: true, email: true } },
          closer: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { meetingDate: 'desc' },
        skip,
        take: filters.pageSize,
      }),
      this.fetchDayCounts(filters),
    ]);

    const rows: MeetingHeldRow[] = leads.map((lead) => ({
      leadId: lead.id,
      leadCode: lead.leadCode,
      leadName: lead.name,
      meetingDate: lead.meetingDate?.toISOString() ?? '',
      status: lead.status ?? '',
      sdr: lead.assignee
        ? {
            id: lead.assignee.id,
            name: lead.assignee.fullName ?? lead.assignee.email ?? 'Usuário',
          }
        : null,
      closer: lead.closer
        ? {
            id: lead.closer.id,
            name: lead.closer.fullName ?? lead.closer.email ?? 'Usuário',
          }
        : null,
    }));

    return {
      rows,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalRows,
        totalPages: Math.max(1, Math.ceil(totalRows / filters.pageSize)),
      },
      dayCounts: countRows,
    };
  }

  private async fetchDayCounts(
    filters: PerformanceMeetingsHeldFilters
  ): Promise<Record<string, number>> {
    const monthRange = filters.countMonth
      ? resolveCountMonthRange(filters.countMonth, filters.userTimezone)
      : null;

    const dateRange = monthRange ?? {
      start: filters.startDate,
      end: filters.endDate,
    };

    const rows = await prisma.lead.findMany({
      where: {
        teamId: filters.teamId,
        meetingHeald: 'yes',
        meetingDate: { gte: dateRange.start, lte: dateRange.end },
        ...(filters.sdrId ? { assignedTo: filters.sdrId } : {}),
        ...(filters.closerId ? { closerId: filters.closerId } : {}),
      },
      select: { meetingDate: true },
    });

    const dayCounts: Record<string, number> = {};
    for (const row of rows) {
      if (!row.meetingDate) continue;
      const key = row.meetingDate.toISOString().slice(0, 10);
      dayCounts[key] = (dayCounts[key] ?? 0) + 1;
    }
    return dayCounts;
  }
}

export const performanceMeetingsHeldService = new PerformanceMeetingsHeldService();
