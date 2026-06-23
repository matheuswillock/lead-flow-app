import { Output } from "@/lib/output";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import { leadTransferRepository } from "@/app/api/infra/data/repositories/leadTransfer/LeadTransferRepository";
import type {
  ILeadTransferUseCase,
  LeadTransferListItem,
  LeadTransferListQuery,
  LeadTransferListResult,
} from "./ILeadTransferUseCase";

function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

function mapPendingRows(
  rows: Awaited<ReturnType<typeof leadTransferRepository.findPendingByTeam>>
): LeadTransferListItem[] {
  return rows.map((row) => ({
    transferState: "pending",
    transferId: null,
    leadId: row.leadId,
    leadName: row.leadName,
    leadEmail: row.leadEmail,
    leadPhone: row.leadPhone,
    leadStatus: row.leadStatus,
    sdr: row.sdr,
    closer: row.closer,
    destinationTeam: null,
    transferredBy: null,
    transferDate: null,
    preScheduledAt: toIso(row.preScheduledAt),
    sortDate: row.sortDate.toISOString(),
  }));
}

function mapCompletedRows(
  rows: Awaited<ReturnType<typeof leadTransferRepository.findCompletedByTeam>>
): LeadTransferListItem[] {
  return rows.map((row) => ({
    transferState: "completed",
    transferId: row.transferId,
    leadId: row.leadId,
    leadName: row.leadName,
    leadEmail: row.leadEmail,
    leadPhone: row.leadPhone,
    leadStatus: row.leadStatus,
    sdr: row.sdr,
    closer: row.closer,
    destinationTeam: {
      id: row.destinationTeamId,
      name: row.destinationTeamName,
    },
    transferredBy: row.transferredBy,
    transferDate: toIso(row.transferDate),
    preScheduledAt: toIso(row.preScheduledAt),
    sortDate: row.sortDate.toISOString(),
  }));
}

export class LeadTransferUseCase implements ILeadTransferUseCase {
  async listWithCtx(ctx: TeamAccess, query: LeadTransferListQuery): Promise<Output> {
    try {
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
      const status = query.status ?? "all";

      const repoFilters = {
        teamId: ctx.teamId,
        search: query.search,
        leadStatus: query.leadStatus,
        toTeamId: query.toTeamId,
        transferredByProfileId: query.transferredByProfileId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      };

      const [pendingRows, completedRows, facets] = await Promise.all([
        status === "completed"
          ? Promise.resolve([])
          : leadTransferRepository.findPendingByTeam(repoFilters),
        status === "pending"
          ? Promise.resolve([])
          : leadTransferRepository.findCompletedByTeam(repoFilters),
        leadTransferRepository.findFacetsByTeam(ctx.teamId),
      ]);

      const merged = [
        ...mapPendingRows(pendingRows),
        ...mapCompletedRows(completedRows),
      ].sort((a, b) => b.sortDate.localeCompare(a.sortDate));

      const total = merged.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const start = (page - 1) * pageSize;
      const items = merged.slice(start, start + pageSize);

      const result: LeadTransferListResult = {
        items,
        total,
        page,
        pageSize,
        totalPages,
        facets,
      };

      return new Output(true, [], [], result);
    } catch (error) {
      console.error("[LeadTransferUseCase][listWithCtx] Erro ao listar transferências:", error);
      return new Output(false, [], ["Erro interno do servidor ao listar transferências de leads"], null);
    }
  }
}

export const leadTransferUseCase = new LeadTransferUseCase();
