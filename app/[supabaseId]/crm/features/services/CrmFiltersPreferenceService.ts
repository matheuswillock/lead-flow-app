import { DEFAULT_CRM_FILTERS, type CrmFiltersState } from "../context/CrmTypes";
import type {
  CrmPreferenceScope,
  ICrmFiltersPreferenceService,
} from "./ICrmFiltersPreferenceService";

const FILTERS_KEY_PREFIX = "crm:filters";

class CrmFiltersPreferenceService implements ICrmFiltersPreferenceService {
  private getStorageKey(scope: CrmPreferenceScope): string {
    const supabaseId = scope.supabaseId ?? "anonymous";
    const teamId = scope.teamId ?? "default";
    return `${FILTERS_KEY_PREFIX}:${supabaseId}:${teamId}`;
  }

  getFilters(scope: CrmPreferenceScope): CrmFiltersState | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem(this.getStorageKey(scope));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CRM_FILTERS, ...parsed } as CrmFiltersState;
    } catch (error) {
      console.error(
        "[CrmFiltersPreferenceService] Error reading session storage:",
        error
      );
      return null;
    }
  }

  setFilters(scope: CrmPreferenceScope, filters: CrmFiltersState): void {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        this.getStorageKey(scope),
        JSON.stringify(filters)
      );
    } catch (error) {
      console.error(
        "[CrmFiltersPreferenceService] Error writing session storage:",
        error
      );
    }
  }
}

export const createCrmFiltersPreferenceService =
  (): ICrmFiltersPreferenceService => new CrmFiltersPreferenceService();
