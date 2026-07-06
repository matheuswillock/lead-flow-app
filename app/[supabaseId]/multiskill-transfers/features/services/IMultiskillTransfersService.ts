import type {
  MultiskillTransfersData,
  MultiskillTransfersFiltersState,
} from "../context/MultiskillTransfersTypes";

export interface IMultiskillTransfersService {
  listTargets(
    supabaseId: string,
    filters: MultiskillTransfersFiltersState
  ): Promise<MultiskillTransfersData>;
}
