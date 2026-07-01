'use client';

import { createContext, useContext, ReactNode, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { DashboardContextType, IDashboardContext } from './DashboardTypes';
import { useDashboardHook } from './DashboardHook';
import { IDashboardMetricsService, MetricsFilters } from '../services/IDashboardMetricsService';
import { dashboardMetricsService } from '../services/DashboardMetricsService';
import { useTeamContext } from '@/app/context/TeamContext';
import { isManagerLikeRole } from '@/lib/roles';
import type { DashboardTeamScope } from './DashboardTypes';

interface IDashboardProviderProps {
  children: ReactNode;
  dashboardService?: IDashboardMetricsService;
  initialFilters?: MetricsFilters;
}

const TEAM_SCOPE_STORAGE_PREFIX = 'dashboardTeamScope';

export const DashboardContext = createContext<DashboardContextType>(undefined);

export const DashboardProvider: React.FC<IDashboardProviderProps> = ({
  children,
  dashboardService = dashboardMetricsService,
  initialFilters = { period: '30d' }
}) => {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId, activeTeam, teams, isTeamMaster } = useTeamContext();
  const [teamScope, setTeamScopeState] = useState<DashboardTeamScope>('active');
  const masterIdRef = useRef<string | null>(null);

  const accountTeams = useMemo(() => {
    if (!activeTeam?.masterId) return [];
    return teams.filter((team) => team.masterId === activeTeam.masterId && !team.isPending);
  }, [teams, activeTeam?.masterId]);

  const canUseAllTeamsScope = useMemo(() => {
    const isDelegated = isManagerLikeRole(activeTeam?.role) && !!activeTeam?.canViewAllTeams;
    return (isTeamMaster || isDelegated) && accountTeams.length > 1;
  }, [isTeamMaster, activeTeam?.role, activeTeam?.canViewAllTeams, accountTeams.length]);

  const teamScopeStorageKey = supabaseId ? `${TEAM_SCOPE_STORAGE_PREFIX}:${supabaseId}` : null;

  useEffect(() => {
    if (!teamScopeStorageKey || typeof window === 'undefined') return;

    try {
      const stored = window.localStorage.getItem(teamScopeStorageKey);
      if (stored === 'all' || stored === 'active') {
        setTeamScopeState(stored);
      }
    } catch (error) {
      console.warn('Não foi possível carregar o escopo do dashboard:', error);
    }
  }, [teamScopeStorageKey]);

  useEffect(() => {
    if (!activeTeam?.masterId) return;

    if (masterIdRef.current && masterIdRef.current !== activeTeam.masterId) {
      setTeamScopeState('active');
      if (teamScopeStorageKey && typeof window !== 'undefined') {
        window.localStorage.setItem(teamScopeStorageKey, 'active');
      }
    }

    masterIdRef.current = activeTeam.masterId;
  }, [activeTeam?.masterId, teamScopeStorageKey]);

  useEffect(() => {
    if (!canUseAllTeamsScope && teamScope === 'all') {
      setTeamScopeState('active');
      if (teamScopeStorageKey && typeof window !== 'undefined') {
        window.localStorage.setItem(teamScopeStorageKey, 'active');
      }
    }
  }, [canUseAllTeamsScope, teamScope, teamScopeStorageKey]);

  const handleTeamScopeChange = useCallback((scope: DashboardTeamScope) => {
    setTeamScopeState(scope);
    if (teamScopeStorageKey && typeof window !== 'undefined') {
      window.localStorage.setItem(teamScopeStorageKey, scope);
    }
  }, [teamScopeStorageKey]);

  const dashboardState = useDashboardHook({
    supabaseId,
    teamId: activeTeamId || '',
    teamScope,
    canUseAllTeamsScope,
    dashboardService,
    initialFilters,
    onTeamScopeChange: handleTeamScopeChange,
  });

  useEffect(() => {
    if (supabaseId && activeTeamId) {
      dashboardState.fetchMetrics();
    }
  }, [supabaseId, activeTeamId, dashboardState.teamScope, dashboardState.fetchMetrics]);

  return (
    <DashboardContext.Provider value={dashboardState}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboardContext = (): IDashboardContext => {
  const context = useContext(DashboardContext);
  
  if (!context) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  
  return context;
};
