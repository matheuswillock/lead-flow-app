import { Prisma } from '@prisma/client';
import { prisma } from '@/app/api/infra/data/prisma';
import type {
  IPerformanceService,
  PerformanceSalesFilters,
  PerformanceSalesResult,
  PerformanceRankingEntry,
  PerformanceSaleRow,
  PerformanceDrilldownEntry,
} from './IPerformanceService';

type PersonAccumulator = {
  profileId: string;
  name: string;
  email: string;
  salesCount: number;
  scheduledLeadIds: Set<string>;
  meetingsHeld: number;
  noShowCount: number;
  totalSalesValue: number;
};

function createAccumulator(profileId: string, name: string, email: string): PersonAccumulator {
  return {
    profileId,
    name,
    email,
    salesCount: 0,
    scheduledLeadIds: new Set<string>(),
    meetingsHeld: 0,
    noShowCount: 0,
    totalSalesValue: 0,
  };
}

function toRankingEntry(item: PersonAccumulator): PerformanceRankingEntry {
  const scheduledLeads = item.scheduledLeadIds.size;
  const attendanceBase = item.meetingsHeld + item.noShowCount;
  const attendanceRate = attendanceBase > 0 ? (item.meetingsHeld / attendanceBase) * 100 : 0;

  return {
    profileId: item.profileId,
    name: item.name,
    count: scheduledLeads,
    totalSalesValue: item.totalSalesValue,
    meetingsHeld: item.meetingsHeld,
    noShowCount: item.noShowCount,
    attendanceRate: Math.round(attendanceRate * 100) / 100,
  };
}

function toDrilldownEntry(item: PersonAccumulator, roleLabel: 'Closer' | 'SDR'): PerformanceDrilldownEntry {
  const scheduledLeads = item.scheduledLeadIds.size;
  const noShowRate = scheduledLeads > 0 ? (item.noShowCount / scheduledLeads) * 100 : 0;
  const attendanceBase = item.meetingsHeld + item.noShowCount;
  const attendanceRate = attendanceBase > 0 ? (item.meetingsHeld / attendanceBase) * 100 : 0;

  return {
    profileId: item.profileId,
    name: item.name,
    roleLabel,
    email: item.email,
    salesCount: item.salesCount,
    scheduledLeads,
    meetingsHeld: item.meetingsHeld,
    noShowCount: item.noShowCount,
    noShowRate: Math.round(noShowRate * 100) / 100,
    attendanceRate: Math.round(attendanceRate * 100) / 100,
    totalSalesValue: item.totalSalesValue,
  };
}

export class PerformanceService implements IPerformanceService {
  async getSalesPerformance(filters: PerformanceSalesFilters): Promise<PerformanceSalesResult> {
    const {
      teamId,
      profileId,
      isManager,
      isCloser,
      startDate,
      endDate,
      sdrId,
      closerId,
      search,
      page,
      pageSize,
    } = filters;

    const leadScope: Prisma.LeadWhereInput = {
      teamId,
      ...(isCloser && !isManager ? { closerId: profileId } : {}),
      ...(sdrId ? { assignedTo: sdrId } : {}),
      ...(closerId && (isManager || !isCloser) ? { closerId } : {}),
      ...(search ? { name: { contains: search, mode: Prisma.QueryMode.insensitive } } : {}),
    };

    const [
      profileRows,
      finalizedRows,
      heldMeetingRows,
      noShowRows,
      scheduledRows,
    ] = await Promise.all([
      prisma.profile.findMany({
        where: {
          teamMemberships: { some: { teamId } },
        },
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      }),
      prisma.leadFinalized.findMany({
        where: {
          finalizedDateAt: { gte: startDate, lte: endDate },
          lead: leadScope,
        },
        include: {
          lead: {
            select: {
              id: true,
              leadCode: true,
              name: true,
              ticket: true,
              currentValue: true,
              soldPlan: true,
              contractDueDate: true,
              meetingHeald: true,
              assignedTo: true,
              closerId: true,
              assignee: { select: { id: true, fullName: true, email: true } },
              closer: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
        orderBy: { finalizedDateAt: 'desc' },
      }),
      prisma.lead.findMany({
        where: {
          ...leadScope,
          meetingHeald: 'yes',
          meetingDate: { gte: startDate, lte: endDate },
        },
        select: {
          id: true,
          assignedTo: true,
          closerId: true,
        },
      }),
      prisma.lead.findMany({
        where: {
          ...leadScope,
          status: 'no_show',
          statusEnteredAt: { gte: startDate, lte: endDate },
        },
        select: {
          id: true,
          assignedTo: true,
          closerId: true,
        },
      }),
      prisma.leadsSchedule.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          lead: leadScope,
        },
        select: {
          leadId: true,
          lead: {
            select: {
              assignedTo: true,
              closerId: true,
            },
          },
        },
      }),
    ]);

    const profileById = new Map(profileRows.map((p) => [p.id, p]));

    const sdrMap = new Map<string, PersonAccumulator>();
    const closerMap = new Map<string, PersonAccumulator>();

    const ensureSdr = (id: string | null | undefined): PersonAccumulator | null => {
      if (!id) return null;
      const profile = profileById.get(id);
      const name = profile?.fullName ?? profile?.email ?? 'Usuário';
      const email = profile?.email ?? '';
      const existing = sdrMap.get(id);
      if (existing) return existing;
      const created = createAccumulator(id, name, email);
      sdrMap.set(id, created);
      return created;
    };

    const ensureCloser = (id: string | null | undefined): PersonAccumulator | null => {
      if (!id) return null;
      const profile = profileById.get(id);
      const name = profile?.fullName ?? profile?.email ?? 'Usuário';
      const email = profile?.email ?? '';
      const existing = closerMap.get(id);
      if (existing) return existing;
      const created = createAccumulator(id, name, email);
      closerMap.set(id, created);
      return created;
    };

    const scheduledLeadIds = new Set<string>();

    for (const row of scheduledRows) {
      scheduledLeadIds.add(row.leadId);
      const sdr = ensureSdr(row.lead.assignedTo);
      if (sdr) sdr.scheduledLeadIds.add(row.leadId);
      const closer = ensureCloser(row.lead.closerId);
      if (closer) closer.scheduledLeadIds.add(row.leadId);
    }

    for (const row of heldMeetingRows) {
      const sdr = ensureSdr(row.assignedTo);
      if (sdr) sdr.meetingsHeld += 1;
      const closer = ensureCloser(row.closerId);
      if (closer) closer.meetingsHeld += 1;
    }

    for (const row of noShowRows) {
      const sdr = ensureSdr(row.assignedTo);
      if (sdr) sdr.noShowCount += 1;
      const closer = ensureCloser(row.closerId);
      if (closer) closer.noShowCount += 1;
    }

    for (const row of finalizedRows) {
      const ticket = row.lead.ticket ? Number(row.lead.ticket) : 0;
      const currentValue = row.lead.currentValue ? Number(row.lead.currentValue) : 0;
      const saleValue = ticket > 0 ? ticket : currentValue;

      const sdr = ensureSdr(row.lead.assignedTo);
      if (sdr) {
        sdr.salesCount += 1;
        sdr.totalSalesValue += saleValue;
      }

      const closer = ensureCloser(row.lead.closerId);
      if (closer) {
        closer.salesCount += 1;
        closer.totalSalesValue += saleValue;
      }
    }

    const sdrRanking = Array.from(sdrMap.values())
      .map(toRankingEntry)
      .sort((a, b) => b.count - a.count || b.meetingsHeld - a.meetingsHeld || a.name.localeCompare(b.name));

    const closerRanking = Array.from(closerMap.values())
      .map((item) => {
        const base = toRankingEntry(item);
        return { ...base, count: item.salesCount };
      })
      .sort((a, b) => b.count - a.count || b.totalSalesValue - a.totalSalesValue || a.name.localeCompare(b.name));

    const topCloser = closerRanking[0]
      ? {
          profileId: closerRanking[0].profileId,
          name: closerRanking[0].name,
          roleLabel: 'Closer' as const,
          value: closerRanking[0].count,
          suffix: 'vendas' as const,
          attendanceRate: closerRanking[0].attendanceRate,
          totalSalesValue: closerRanking[0].totalSalesValue,
        }
      : null;

    const topSdr = sdrRanking[0]
      ? {
          profileId: sdrRanking[0].profileId,
          name: sdrRanking[0].name,
          roleLabel: 'SDR' as const,
          value: sdrRanking[0].count,
          suffix: 'agend.' as const,
          attendanceRate: sdrRanking[0].attendanceRate,
          totalSalesValue: sdrRanking[0].totalSalesValue,
        }
      : null;

    const drilldown: PerformanceDrilldownEntry[] = [
      ...Array.from(closerMap.values()).map((entry) => toDrilldownEntry(entry, 'Closer')),
      ...Array.from(sdrMap.values()).map((entry) => toDrilldownEntry(entry, 'SDR')),
    ];

    const totalRows = finalizedRows.length;
    const skip = (page - 1) * pageSize;
    const paginatedRows = finalizedRows.slice(skip, skip + pageSize);

    const rows: PerformanceSaleRow[] = paginatedRows.map((row) => {
      const ticket = row.lead.ticket ? Number(row.lead.ticket) : 0;
      const currentValue = row.lead.currentValue ? Number(row.lead.currentValue) : 0;
      return {
        leadId: row.lead.id,
        leadCode: row.lead.leadCode,
        leadName: row.lead.name,
        saleDate: row.finalizedDateAt,
        meetingHeald: row.lead.meetingHeald,
        sdr: row.lead.assignee
          ? { id: row.lead.assignee.id, name: row.lead.assignee.fullName ?? row.lead.assignee.email ?? 'Usuário' }
          : null,
        closer: row.lead.closer
          ? { id: row.lead.closer.id, name: row.lead.closer.fullName ?? row.lead.closer.email ?? 'Usuário' }
          : null,
        soldPlan: row.lead.soldPlan,
        contractDueDate: row.lead.contractDueDate,
        ticket: row.lead.ticket ? Number(row.lead.ticket) : null,
        currentValue: row.lead.currentValue ? Number(row.lead.currentValue) : null,
        saleValue: ticket > 0 ? ticket : currentValue,
      };
    });

    const noShowCount = noShowRows.length;
    const scheduledLeads = scheduledLeadIds.size;

    return {
      kpis: {
        closedSales: finalizedRows.length,
        meetingsHeld: heldMeetingRows.length,
        scheduledLeads,
        noShowRate: scheduledLeads > 0 ? Math.round((noShowCount / scheduledLeads) * 10000) / 100 : 0,
        noShowCount,
      },
      highlights: {
        topCloser,
        topSdr,
      },
      rankings: {
        sdr: sdrRanking,
        closer: closerRanking,
      },
      drilldown,
      rows,
      pagination: {
        page,
        pageSize,
        totalRows,
        totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
      },
    };
  }
}

export const performanceService = new PerformanceService();
