import { CrmViewMode } from "../context/CrmTypes";

export interface CrmViewPreferenceScope {
  supabaseId?: string;
  teamId?: string | null;
}

export interface ICrmViewPreferenceService {
  getPreferredViewMode(scope: CrmViewPreferenceScope): CrmViewMode | null;
  setPreferredViewMode(scope: CrmViewPreferenceScope, viewMode: CrmViewMode): void;
}
