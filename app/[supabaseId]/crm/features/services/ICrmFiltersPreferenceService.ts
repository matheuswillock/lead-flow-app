import type { CrmFiltersState } from "../context/CrmTypes";

export interface CrmPreferenceScope {
  supabaseId?: string;
  teamId?: string | null;
}

export interface ICrmFiltersPreferenceService {
  getFilters(scope: CrmPreferenceScope): CrmFiltersState | null;
  setFilters(scope: CrmPreferenceScope, filters: CrmFiltersState): void;
}
