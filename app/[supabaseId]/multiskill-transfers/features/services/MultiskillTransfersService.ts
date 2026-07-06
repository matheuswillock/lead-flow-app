import type { IMultiskillTransfersService } from "./IMultiskillTransfersService";
import type {
  MultiskillTransfersData,
  MultiskillTransfersFiltersState,
} from "../context/MultiskillTransfersTypes";

export class MultiskillTransfersService implements IMultiskillTransfersService {
  async listTargets(
    supabaseId: string,
    filters: MultiskillTransfersFiltersState
  ): Promise<MultiskillTransfersData> {
    const params = new URLSearchParams();
    if (filters.q.trim()) params.set("q", filters.q.trim());
    params.set("page", String(filters.page));
    params.set("pageSize", String(filters.pageSize));

    const response = await fetch(`/api/v1/multiskill/transfer-targets?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": supabaseId,
      },
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok || !result?.isValid) {
      throw new Error(result?.errorMessages?.join(", ") ?? "Erro ao carregar destinos MultiSkill");
    }

    return result.result as MultiskillTransfersData;
  }
}

export const multiskillTransfersService = new MultiskillTransfersService();
