import { Prisma } from '@prisma/client';
import { prisma } from '@/app/api/infra/data/prisma';
import type {
  IPerformanceService,
  PerformanceSalesFilters,
  PerformanceSalesResult,
  PerformanceRankingEntry,
  PerformanceSaleRow,
} from './IPerformanceService';

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

    const baseWhere: Prisma.LeadFinalizedWhereInput = {
      finalizedDateAt: {
        gte: startDate,
        lte: endDate,
      },
      lead: {
        teamId,
        meetingHeald: 'yes',
        status: 'contract_finalized',
        ...(isCloser && !isManager ? { closerId: profileId } : {}),
        ...(sdrId ? { assignedTo: sdrId } : {}),
        ...(closerId && (isManager || !isCloser) ? { closerId } : {}),
        ...(search
          ? { name: { contains: search, mode: Prisma.QueryMode.insensitive } }
          : {}),
      },
    };

    const include = {
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
          assignee: { select: { id: true, fullName: true } },
          closer: { select: { id: true, fullName: true } },
        },
      },
    } satisfies Prisma.LeadFinalizedInclude;

    // Full result for summary + rankings
    const allRows = await prisma.leadFinalized.findMany({
      where: baseWhere,
      include,
      orderBy: { finalizedDateAt: 'desc' },
    });

    const totalRows = allRows.length;
    let totalSalesValue = 0;
    const sdrMap = new Map<string, PerformanceRankingEntry>();
    const closerMap = new Map<string, PerformanceRankingEntry>();

    for (const row of allRows) {
      const ticket = row.lead.ticket ? Number(row.lead.ticket) : 0;
      const currentValue = row.lead.currentValue ? Number(row.lead.currentValue) : 0;
      const saleValue = ticket > 0 ? ticket : currentValue;
      totalSalesValue += saleValue;

      if (row.lead.assignee) {
        const sdrId = row.lead.assignee.id;
        const existing = sdrMap.get(sdrId);
        if (existing) {
          existing.count += 1;
          existing.totalSalesValue += saleValue;
        } else {
          sdrMap.set(sdrId, {
            profileId: sdrId,
            name: row.lead.assignee.fullName ?? '',
            count: 1,
            totalSalesValue: saleValue,
          });
        }
      }

      if (row.lead.closer) {
        const closerProfileId = row.lead.closer.id;
        const existing = closerMap.get(closerProfileId);
        if (existing) {
          existing.count += 1;
          existing.totalSalesValue += saleValue;
        } else {
          closerMap.set(closerProfileId, {
            profileId: closerProfileId,
            name: row.lead.closer.fullName ?? '',
            count: 1,
            totalSalesValue: saleValue,
          });
        }
      }
    }

    const sdrRanking = Array.from(sdrMap.values()).sort((a, b) => b.count - a.count);
    const closerRanking = Array.from(closerMap.values()).sort((a, b) => b.count - a.count);

    // Paginated rows
    const skip = (page - 1) * pageSize;
    const paginatedRows = allRows.slice(skip, skip + pageSize);

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
          ? { id: row.lead.assignee.id, name: row.lead.assignee.fullName ?? '' }
          : null,
        closer: row.lead.closer
          ? { id: row.lead.closer.id, name: row.lead.closer.fullName ?? '' }
          : null,
        soldPlan: row.lead.soldPlan,
        contractDueDate: row.lead.contractDueDate,
        ticket: row.lead.ticket ? Number(row.lead.ticket) : null,
        currentValue: row.lead.currentValue ? Number(row.lead.currentValue) : null,
        saleValue: ticket > 0 ? ticket : currentValue,
      };
    });

    return {
      summary: {
        soldLeads: totalRows,
        totalSalesValue,
      },
      sdrRanking,
      closerRanking,
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
