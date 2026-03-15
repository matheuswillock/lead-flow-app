import { CrmViewMode, normalizeCrmViewMode } from "../context/CrmTypes";
import {
  CrmViewPreferenceScope,
  ICrmViewPreferenceService,
} from "./ICrmViewPreferenceService";

const STORAGE_KEY_PREFIX = "crm:view-mode";

class CrmViewPreferenceService implements ICrmViewPreferenceService {
  private getStorageKey(scope: CrmViewPreferenceScope) {
    const supabaseId = scope.supabaseId || "anonymous";
    const teamId = scope.teamId || "default";
    return `${STORAGE_KEY_PREFIX}:${supabaseId}:${teamId}`;
  }

  getPreferredViewMode(scope: CrmViewPreferenceScope): CrmViewMode | null {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const rawValue = window.sessionStorage.getItem(this.getStorageKey(scope));
      return normalizeCrmViewMode(rawValue);
    } catch (error) {
      console.error("[CrmViewPreferenceService] Error reading session storage:", error);
      return null;
    }
  }

  setPreferredViewMode(scope: CrmViewPreferenceScope, viewMode: CrmViewMode): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.sessionStorage.setItem(this.getStorageKey(scope), viewMode);
    } catch (error) {
      console.error("[CrmViewPreferenceService] Error writing session storage:", error);
    }
  }
}

export const createCrmViewPreferenceService = (): ICrmViewPreferenceService => {
  return new CrmViewPreferenceService();
};
