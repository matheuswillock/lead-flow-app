"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTeamContext } from "@/app/context/TeamContext";
import {
  CRM_DEFAULT_VIEW_MODE,
  CrmViewMode,
  normalizeCrmViewMode,
} from "./CrmTypes";
import {
  CrmViewPreferenceScope,
  ICrmViewPreferenceService,
} from "../services/ICrmViewPreferenceService";
import { createCrmViewPreferenceService } from "../services/CrmViewPreferenceService";
import {
  CrmFiltersState,
  DEFAULT_CRM_FILTERS,
} from "./CrmTypes";
import type { ICrmFiltersPreferenceService } from "../services/ICrmFiltersPreferenceService";
import { createCrmFiltersPreferenceService } from "../services/CrmFiltersPreferenceService";

interface ICrmProviderProps {
  children: ReactNode;
  viewPreferenceService?: ICrmViewPreferenceService;
  filtersPreferenceService?: ICrmFiltersPreferenceService;
}

interface ICrmContextState {
  isReady: boolean;
  viewMode: CrmViewMode;
  setViewMode: (viewMode: CrmViewMode) => void;
  crmFilters: CrmFiltersState;
  setCrmFilters: (filters: CrmFiltersState) => void;
  setCrmFilter: <K extends keyof CrmFiltersState>(
    key: K,
    value: CrmFiltersState[K]
  ) => void;
  clearCrmFilters: () => void;
}

export const CrmContext = createContext<ICrmContextState | undefined>(undefined);

export function CrmProvider({
  children,
  viewPreferenceService,
  filtersPreferenceService,
}: ICrmProviderProps) {
  const resolvedViewPreferenceService = useMemo(
    () => viewPreferenceService ?? createCrmViewPreferenceService(),
    [viewPreferenceService]
  );
  const resolvedFiltersPreferenceService = useMemo(
    () => filtersPreferenceService ?? createCrmFiltersPreferenceService(),
    [filtersPreferenceService]
  );

  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId } = useTeamContext();
  const searchParams = useSearchParams();
  const searchViewParam = searchParams.get("view");

  const [isReady, setIsReady] = useState(false);
  const [viewMode, setViewModeState] = useState<CrmViewMode>(CRM_DEFAULT_VIEW_MODE);
  const [crmFilters, setCrmFiltersState] = useState<CrmFiltersState>(DEFAULT_CRM_FILTERS);

  const preferenceScope = useMemo<CrmViewPreferenceScope>(
    () => ({
      supabaseId,
      teamId: activeTeamId,
    }),
    [activeTeamId, supabaseId]
  );

  useEffect(() => {
    setIsReady(false);

    const viewModeFromSearchParam = normalizeCrmViewMode(searchViewParam);
    if (viewModeFromSearchParam) {
      setViewModeState(viewModeFromSearchParam);
      resolvedViewPreferenceService.setPreferredViewMode(
        preferenceScope,
        viewModeFromSearchParam
      );
    } else {
      const preferredViewMode = resolvedViewPreferenceService.getPreferredViewMode(
        preferenceScope
      );
      setViewModeState(preferredViewMode ?? CRM_DEFAULT_VIEW_MODE);
    }

    const savedFilters = resolvedFiltersPreferenceService.getFilters(preferenceScope);
    setCrmFiltersState(savedFilters ?? DEFAULT_CRM_FILTERS);

    setIsReady(true);
  }, [
    preferenceScope,
    resolvedViewPreferenceService,
    resolvedFiltersPreferenceService,
    searchViewParam,
  ]);

  const setViewMode = useCallback(
    (nextViewMode: CrmViewMode) => {
      setViewModeState(nextViewMode);
      resolvedViewPreferenceService.setPreferredViewMode(
        preferenceScope,
        nextViewMode
      );
    },
    [preferenceScope, resolvedViewPreferenceService]
  );

  const setCrmFilters = useCallback(
    (filters: CrmFiltersState) => {
      setCrmFiltersState(filters);
      resolvedFiltersPreferenceService.setFilters(preferenceScope, filters);
    },
    [preferenceScope, resolvedFiltersPreferenceService]
  );

  const setCrmFilter = useCallback(
    <K extends keyof CrmFiltersState>(key: K, value: CrmFiltersState[K]) => {
      setCrmFiltersState((prev) => {
        const next = { ...prev, [key]: value };
        resolvedFiltersPreferenceService.setFilters(preferenceScope, next);
        return next;
      });
    },
    [preferenceScope, resolvedFiltersPreferenceService]
  );

  const clearCrmFilters = useCallback(() => {
    setCrmFilters(DEFAULT_CRM_FILTERS);
  }, [setCrmFilters]);

  const value = useMemo(
    () => ({
      isReady,
      viewMode,
      setViewMode,
      crmFilters,
      setCrmFilters,
      setCrmFilter,
      clearCrmFilters,
    }),
    [isReady, viewMode, setViewMode, crmFilters, setCrmFilters, setCrmFilter, clearCrmFilters]
  );

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}
