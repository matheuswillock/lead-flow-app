import type { ILeadTransfersService } from "./ILeadTransfersService";
import type {
  LeadTransfersData,
  LeadTransfersFiltersState,
} from "../context/LeadTransfersTypes";

class LeadTransfersService implements ILeadTransfersService {
  async list(
    supabaseId: string,
    teamId: string,
    filters: LeadTransfersFiltersState
  ): Promise<LeadTransfersData> {
    const params = new URLSearchParams();

    if (filters.search) params.set("search", filters.search);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.leadStatus) params.set("leadStatus", filters.leadStatus);
    if (filters.toTeamId) params.set("toTeamId", filters.toTeamId);
    if (filters.transferredByProfileId) {
      params.set("transferredByProfileId", filters.transferredByProfileId);
    }
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
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
