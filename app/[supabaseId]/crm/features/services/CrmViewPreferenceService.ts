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
      const storageKey = this.getStorageKey(scope);
      const rawValue =
        window.localStorage.getItem(storageKey) ??
        window.sessionStorage.getItem(storageKey);
      if (rawValue && !window.localStorage.getItem(storageKey)) {
        window.localStorage.setItem(storageKey, rawValue);
      }
      return normalizeCrmViewMode(rawValue);
    } catch (error) {
      console.error("[CrmViewPreferenceService] Error reading local storage:", error);
      return null;
    }
  }

  setPreferredViewMode(scope: CrmViewPreferenceScope, viewMode: CrmViewMode): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(this.getStorageKey(scope), viewMode);
    } catch (error) {
      console.error("[CrmViewPreferenceService] Error writing local storage:", error);
    }
  }
}

export const createCrmViewPreferenceService = (): ICrmViewPreferenceService => {
  return new CrmViewPreferenceService();
};
