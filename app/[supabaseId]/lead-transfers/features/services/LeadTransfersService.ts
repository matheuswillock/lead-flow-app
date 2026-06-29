import type { ILeadTransfersService } from "./ILeadTransfersService";
import type {
  LeadTransfersData,
  LeadTransfersFiltersState,
} from "../context/LeadTransfersTypes";

function appendCsv(params: URLSearchParams, key: string, values: string[]) {
  if (values.length > 0) {
    params.set(key, values.join(","));
  }
}

class LeadTransfersService implements ILeadTransfersService {
  async list(
    supabaseId: string,
    teamId: string,
    filters: LeadTransfersFiltersState
  ): Promise<LeadTransfersData> {
    const params = new URLSearchParams();

    if (filters.search) params.set("search", filters.search);
    appendCsv(params, "transferStatuses", filters.transferStatuses);
    if (filters.leadStatus) params.set("leadStatus", filters.leadStatus);
    appendCsv(params, "toTeamIds", filters.toTeamIds);
    appendCsv(params, "transferredByProfileIds", filters.transferredByProfileIds);
    appendCsv(params, "sdrProfileIds", filters.sdrProfileIds);
    appendCsv(params, "closerProfileIds", filters.closerProfileIds);
    if (filters.transferDateFrom) params.set("transferDateFrom", filters.transferDateFrom);
    if (filters.transferDateTo) params.set("transferDateTo", filters.transferDateTo);
    if (filters.preScheduledDateFrom) params.set("preScheduledDateFrom", filters.preScheduledDateFrom);
    if (filters.preScheduledDateTo) params.set("preScheduledDateTo", filters.preScheduledDateTo);
    if (filters.scheduledDateFrom) params.set("scheduledDateFrom", filters.scheduledDateFrom);
    if (filters.scheduledDateTo) params.set("scheduledDateTo", filters.scheduledDateTo);
    params.set("page", String(filters.page));
    params.set("pageSize", String(filters.pageSize));

    const res = await fetch(`/api/v1/lead-transfers?${params.toString()}`, {
      headers: {
        "x-supabase-user-id": supabaseId,
        "x-team-id": teamId,
      },
    });

    const json = await res.json();
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao buscar transferências");
    }

    return json.result as LeadTransfersData;
  }
}

export const leadTransfersService = new LeadTransfersService();
