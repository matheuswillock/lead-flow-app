import { Prisma } from '@prisma/client';
import { prisma } from '@/app/api/infra/data/prisma';
import type {
  IPerformanceService,
  PerformanceSalesFilters,
  PerformanceSalesResult,
  PerformanceRankingEntry,
  PerformanceSaleRow,
  PerformanceDrilldownEntry,
  PerformanceRecentActivity,
  PerformanceActivityKind,
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

function toDrilldownEntry(
  item: PersonAccumulator,
  roleLabel: 'Closer' | 'SDR',
  recentActivities: PerformanceRecentActivity[]
): PerformanceDrilldownEntry {
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
    recentActivities,
  };
}

function calcDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function resolveActivityKind(
  type: string,
  payload: Record<string, unknown> | null
): PerformanceActivityKind | null {
  if (type === 'status_change') {
    const to = payload?.to as string | undefined;
    if (to === 'contract_finalized') return 'sale';
    if (to === 'offerSubmission') return 'proposal_sent';
    if (to === 'no_show') return 'no_show';
    if (to === 'new_opportunity') return 'new_lead';
  }
  if (type === 'note') {
    const p = payload as Record<string, unknown> | null;
    if (p?.meetingHeald === 'yes') return 'meeting_held';
    if (p?.kind === 'schedule') return 'scheduled';
  }
  return null;
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

    // Previous period: mirror the same duration before startDate
    const durationMs = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - durationMs);
    const prevEndDate = startDate;

    const [
      profileRows,
      finalizedRows,
      heldMeetingRows,
      noShowRows,
      scheduledRows,
      activityRows,
      prevFinalizedRows,
      prevHeldMeetingRows,
      prevNoShowRows,
      prevScheduledRows,
    ] = await Promise.all([
      // All team profiles
      prisma.profile.findMany({
        where: { teamMemberships: { some: { teamId } } },
        select: { id: true, fullName: true, email: true },
      }),

      // Current: contract_finalized leads
      prisma.lead.findMany({
        where: {
          ...leadScope,
          status: 'contract_finalized',
          statusEnteredAt: { gte: startDate, lte: endDate },
        },
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
          statusEnteredAt: true,
          assignee: { select: { id: true, fullName: true, email: true } },
          closer: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { statusEnteredAt: 'desc' },
      }),

      // Current: meetings held
      prisma.lead.findMany({
        where: {
          ...leadScope,
          meetingHeald: 'yes',
          meetingDate: { gte: startDate, lte: endDate },
        },
        select: { id: true, assignedTo: true, closerId: true, meetingDate: true },
      }),

      // Current: no-shows
      prisma.lead.findMany({
        where: {
          ...leadScope,
          status: 'no_show',
          statusEnteredAt: { gte: startDate, lte: endDate },
        },
        select: { id: true, assignedTo: true, closerId: true, statusEnteredAt: true },
      }),

      // Current: scheduled leads (via meetingDate)
      prisma.lead.findMany({
        where: {
          ...leadScope,
          status: { in: ['scheduled', 'no_show'] },
          meetingDate: { gte: startDate, lte: endDate },
        },
        select: { id: true, meetingDate: true, assignedTo: true, closerId: true },
      }),

      // Recent activities for drilldown — last 5 days only
      prisma.leadActivity.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            lte: endDate,
          },
          lead: leadScope,
          type: { in: ['note', 'status_change'] },
        },
        select: {
          id: true,
          type: true,
          body: true,
          payload: true,
          createdBy: true,
          createdAt: true,
          lead: { select: { id: true, leadCode: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),

      // Previous period: contract_finalized
      prisma.lead.findMany({
        where: {
          ...leadScope,
          status: 'contract_finalized',
          statusEnteredAt: { gte: prevStartDate, lte: prevEndDate },
        },
        select: { id: true },
      }),

      // Previous period: meetings held
      prisma.lead.findMany({
        where: {
          ...leadScope,
          meetingHeald: 'yes',
          meetingDate: { gte: prevStartDate, lte: prevEndDate },
        },
        select: { id: true },
      }),

      // Previous period: no-shows
      prisma.lead.findMany({
        where: {
          ...leadScope,
          status: 'no_show',
          statusEnteredAt: { gte: prevStartDate, lte: prevEndDate },
        },
        select: { id: true },
      }),

      // Previous period: scheduled
      prisma.lead.findMany({
        where: {
          ...leadScope,
          status: { in: ['scheduled', 'no_show'] },
          meetingDate: { gte: prevStartDate, lte: prevEndDate },
        },
        select: { id: true },
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
      scheduledLeadIds.add(row.id);
      const sdr = ensureSdr(row.assignedTo);
      if (sdr) sdr.scheduledLeadIds.add(row.id);
      const closer = ensureCloser(row.closerId);
      if (closer) closer.scheduledLeadIds.add(row.id);
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
      // ticket = valor do boleto (receita da venda); sem fallback — currentValue é o plano atual do lead, não o valor da venda
      const saleValue = row.ticket ? Number(row.ticket) : 0;

      const sdr = ensureSdr(row.assignedTo);
      if (sdr) {
        sdr.salesCount += 1;
        sdr.totalSalesValue += saleValue;
      }

      const closer = ensureCloser(row.closerId);
      if (closer) {
        closer.salesCount += 1;
        closer.totalSalesValue += saleValue;
      }
    }

    // Build per-person recent activities map
    const activitiesByProfile = new Map<string, PerformanceRecentActivity[]>();
    for (const row of activityRows) {
      if (!row.createdBy || !row.lead) continue;
      const payload = row.payload as Record<string, unknown> | null;
      const kind = resolveActivityKind(row.type, payload);
      if (!kind) continue;

      const existing = activitiesByProfile.get(row.createdBy) ?? [];
      if (existing.length < 10) {
        existing.push({
          kind,
          text: row.body ?? '',
          leadCode: row.lead.leadCode,
          leadName: row.lead.name,
          createdAt: row.createdAt.toISOString(),
        });
        activitiesByProfile.set(row.createdBy, existing);
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
      .sort((a, b) => b.totalSalesValue - a.totalSalesValue || b.count - a.count || a.name.localeCompare(b.name));

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
      ...Array.from(closerMap.values()).map((entry) =>
        toDrilldownEntry(entry, 'Closer', activitiesByProfile.get(entry.profileId) ?? [])
      ),
      ...Array.from(sdrMap.values()).map((entry) =>
        toDrilldownEntry(entry, 'SDR', activitiesByProfile.get(entry.profileId) ?? [])
      ),
    ];

    const totalRows = finalizedRows.length;
    const skip = (page - 1) * pageSize;
    const paginatedRows = finalizedRows.slice(skip, skip + pageSize);

    const rows: PerformanceSaleRow[] = paginatedRows.map((row) => {
      const saleValue = row.ticket ? Number(row.ticket) : 0;
      return {
        leadId: row.id,
        leadCode: row.leadCode,
        leadName: row.name,
        saleDate: row.statusEnteredAt,
        meetingHeald: row.meetingHeald,
        sdr: row.assignee
          ? { id: row.assignee.id, name: row.assignee.fullName ?? row.assignee.email ?? 'Usuário' }
          : null,
        closer: row.closer
          ? { id: row.closer.id, name: row.closer.fullName ?? row.closer.email ?? 'Usuário' }
          : null,
        soldPlan: row.soldPlan,
        contractDueDate: row.contractDueDate,
        ticket: row.ticket ? Number(row.ticket) : null,
        currentValue: row.currentValue ? Number(row.currentValue) : null,
        saleValue,
      };
    });

    const noShowCount = noShowRows.length;
    const scheduledLeads = scheduledLeadIds.size;
    const noShowRate = scheduledLeads > 0 ? Math.round((noShowCount / scheduledLeads) * 10000) / 100 : 0;

    // Previous period metrics for delta
    const prevScheduledCount = prevScheduledRows.length;
    const prevNoShowCount = prevNoShowRows.length;
    const prevNoShowRate = prevScheduledCount > 0
      ? Math.round((prevNoShowCount / prevScheduledCount) * 10000) / 100
      : 0;

    // Sparkline: always last 7 days within the selected window
    const sparklineByDate = new Map<string, { sales: number; meetings: number; scheduled: number; noShow: number }>();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0]!;
      sparklineByDate.set(dateStr, { sales: 0, meetings: 0, scheduled: 0, noShow: 0 });
    }

    for (const row of finalizedRows) {
      const dateStr = row.statusEnteredAt ? new Date(row.statusEnteredAt).toISOString().split('T')[0] : null;
      if (dateStr && sparklineByDate.has(dateStr)) {
        sparklineByDate.get(dateStr)!.sales += 1;
      }
    }

    for (const row of heldMeetingRows) {
      const dateStr = row.meetingDate ? new Date(row.meetingDate).toISOString().split('T')[0] : null;
      if (dateStr && sparklineByDate.has(dateStr)) {
        sparklineByDate.get(dateStr)!.meetings += 1;
      }
    }

    for (const row of scheduledRows) {
      const dateStr = row.meetingDate ? new Date(row.meetingDate).toISOString().split('T')[0] : null;
      if (dateStr && sparklineByDate.has(dateStr)) {
        sparklineByDate.get(dateStr)!.scheduled += 1;
      }
    }

    for (const row of noShowRows) {
      const dateStr = row.statusEnteredAt ? new Date(row.statusEnteredAt).toISOString().split('T')[0] : null;
      if (dateStr && sparklineByDate.has(dateStr)) {
        sparklineByDate.get(dateStr)!.noShow += 1;
      }
    }

    const sparkValues = Array.from(sparklineByDate.values());
    const closedSalesSparkline = sparkValues.map((d) => ({ value: d.sales }));
    const meetingsHeldSparkline = sparkValues.map((d) => ({ value: d.meetings }));
    const scheduledLeadsSparkline = sparkValues.map((d) => ({ value: d.scheduled }));
    const noShowRateSparkline = sparkValues.map((d) => {
      const total = d.scheduled;
      return { value: total > 0 ? Math.round((d.noShow / total) * 10000) / 100 : 0 };
    });

    return {
      kpis: {
        closedSales: finalizedRows.length,
        closedSalesSparkline,
        closedSalesDelta: calcDelta(finalizedRows.length, prevFinalizedRows.length),
        meetingsHeld: heldMeetingRows.length,
        meetingsHeldSparkline,
        meetingsHeldDelta: calcDelta(heldMeetingRows.length, prevHeldMeetingRows.length),
        scheduledLeads,
        scheduledLeadsSparkline,
        scheduledLeadsDelta: calcDelta(scheduledLeads, prevScheduledRows.length),
        noShowRate,
        noShowCount,
        noShowRateSparkline,
        noShowRateDelta: calcDelta(noShowRate, prevNoShowRate),
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
