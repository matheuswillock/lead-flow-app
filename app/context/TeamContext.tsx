"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Output } from "@/lib/output";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { useUser } from "@/app/context/UserContext";
import {
  readTeamsBootstrapCache,
  writeTeamsBootstrapCache,
} from "@/lib/bootstrap/sessionBootstrapCache";
import { API_CLIENT_BASE } from "@/lib/route-map";

const teamsInFlightBySupabaseId = new Map<string, Promise<Output>>();

export interface TeamSummary {
  id: string;
  name: string;
  masterId: string;
  accountMasterId?: string;
  accountName?: string;
  isOwnAccount?: boolean;
  isAssociateAccount?: boolean;
  sponsorMasterId?: string | null;
  associateAccountName?: string | null;
  isAccessible?: boolean;
  accountSubscriptionActive?: boolean;
  accountMasterBanned?: boolean;
  isDefault: boolean;
  role: "manager" | "backoffice" | "operator";
  functions: ("SDR" | "CLOSER")[];
  canCreateAccountUsers: boolean;
  canManageAccountTeams: boolean;
  canTransferAccountLeads: boolean;
  canViewAllTeams: boolean;
  accountTeamsCount?: number;
  hasTransferRoutes?: boolean;
  membershipCreatedAt: string;
  isPending?: boolean;
  pendingPayment?: {
    id: string;
    paymentId: string;
    paymentStatus: string;
    paymentMethod: string;
    checkoutUrl: string;
  } | null;
}

interface TeamContextState {
  teams: TeamSummary[];
  activeTeamId: string | null;
  activeTeam: TeamSummary | null;
  activeRole: "manager" | "backoffice" | "operator" | null;
  activeFunctions: ("SDR" | "CLOSER")[];
  isTeamMaster: boolean;
  isLoading: boolean;
  error: string | null;
  isSwitchingTeam: boolean;
  switchingTeamName: string | null;
  isTeamSwitchPersisted: boolean;
  refreshTeams: () => Promise<void>;
  setActiveTeamId: (teamId: string) => Promise<void>;
  completeTeamSwitch: () => void;
}

const TeamContext = createContext<TeamContextState | undefined>(undefined);

// Referência estável — evita recriar consumers (ex.: loadLeads do CRM) a cada render
// quando o time ainda não tem functions.
const EMPTY_TEAM_FUNCTIONS: ("SDR" | "CLOSER")[] = [];

function getStorageKey(supabaseId: string) {
  return `activeTeamId:${supabaseId}`;
}

function isTeamSelectable(team: TeamSummary) {
  return !team.isPending && team.isAccessible !== false;
}

function getTeamBlockedMessage(team: TeamSummary) {
  if (team.accountMasterBanned) {
    return "O acesso a esta conta foi suspenso. Entre em contato com o administrador.";
  }
  return "A assinatura desta conta está inativa. Entre em contato com o administrador.";
}

interface TeamProviderProps {
  children: React.ReactNode;
  supabaseId: string;
  /** Dados resolvidos no servidor (layout) — evita o fetch inicial no cliente. */
  initialTeams?: TeamSummary[] | null;
  initialActiveTeamId?: string | null;
}

export const TeamProvider = ({
  children,
  supabaseId,
  initialTeams = null,
  initialActiveTeamId = null,
}: TeamProviderProps) => {
  const { user } = useUser();
  const storageKey = getStorageKey(supabaseId);
  const hasInitialTeams = initialTeams !== null;

  const [teams, setTeams] = useState<TeamSummary[]>(initialTeams ?? []);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(initialActiveTeamId);
  const [isLoading, setIsLoading] = useState(!hasInitialTeams);
  const [error, setError] = useState<string | null>(null);
  const [isSwitchingTeam, setIsSwitchingTeam] = useState(false);
  const [switchingTeamName, setSwitchingTeamName] = useState<string | null>(null);
  const [isTeamSwitchPersisted, setIsTeamSwitchPersisted] = useState(false);
  const serverActiveTeamIdRef = useRef<string | null>(initialActiveTeamId);
  const activeTeamIdRef = useRef<string | null>(initialActiveTeamId);
  const pendingActiveTeamSwitchRef = useRef<string | null>(null);
  const teamSwitchGenerationRef = useRef(0);
  const teamsRef = useRef<TeamSummary[]>(initialTeams ?? []);
  const initializedRef = useRef(false);
  const serverTeamsReadyRef = useRef(hasInitialTeams);
  const bootstrapHydratedRef = useRef(hasInitialTeams);
  const initialFetchSkippedRef = useRef(false);

  useEffect(() => {
    activeTeamIdRef.current = activeTeamId;
  }, [activeTeamId]);

  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  useEffect(() => {
    if (bootstrapHydratedRef.current) return;
    bootstrapHydratedRef.current = true;

    const cached = readTeamsBootstrapCache(supabaseId);
    if (cached) {
      setTeams(cached.teams as TeamSummary[]);
      serverActiveTeamIdRef.current = cached.activeTeamId ?? null;
      if (cached.activeTeamId) {
        setActiveTeamIdState(cached.activeTeamId);
      }
      setIsLoading(false);
      return;
    }

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        setActiveTeamIdState(stored);
      }
    }
  }, [storageKey, supabaseId]);

  const refreshTeams = useCallback(async () => {
    if (!supabaseId) {
      return;
    }

    const cachedTeams = readTeamsBootstrapCache(supabaseId);
    const shouldBlockUi = !cachedTeams;

    try {
      if (shouldBlockUi) {
        setIsLoading(true);
      }
      setError(null);

      const createTeamsRequest = async (): Promise<Output> => {
        const response = await fetch(`${API_CLIENT_BASE}/teams`, {
          headers: {
            "x-supabase-user-id": supabaseId
          }
        });

        const output: Output = await response.json();
        return output;
      };

      const existingRequest = teamsInFlightBySupabaseId.get(supabaseId);
      const requestPromise = existingRequest
        ?? createTeamsRequest().finally(() => {
          teamsInFlightBySupabaseId.delete(supabaseId);
        });

      if (!existingRequest) {
        teamsInFlightBySupabaseId.set(supabaseId, requestPromise);
      }

      const output = await requestPromise;

      if (!output.isValid) {
        setError(output.errorMessages?.join(", ") || "Failed to load teams");
        return;
      }

      const payload = output.result as { teams: TeamSummary[]; activeTeamId: string | null };
      serverTeamsReadyRef.current = true;
      setTeams(payload.teams || []);
      serverActiveTeamIdRef.current = payload.activeTeamId ?? null;

      const resolvedActiveTeamId = payload.activeTeamId ?? activeTeamIdRef.current ?? null;

      writeTeamsBootstrapCache(supabaseId, {
        teams: payload.teams || [],
        activeTeamId: resolvedActiveTeamId,
      });

      if (payload.activeTeamId && !pendingActiveTeamSwitchRef.current) {
        const serverTeam = payload.teams.find((team) => team.id === payload.activeTeamId);
        if (serverTeam && isTeamSelectable(serverTeam) && payload.activeTeamId !== activeTeamIdRef.current) {
          activeTeamIdRef.current = payload.activeTeamId;
          setActiveTeamIdState(payload.activeTeamId);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(storageKey, payload.activeTeamId);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching teams:", err);
      setError("Network error while fetching teams");
    } finally {
      setIsLoading(false);
    }
  }, [storageKey, supabaseId]);

  const persistActiveTeam = useCallback(async (teamId: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, teamId);
    }

    if (serverActiveTeamIdRef.current === teamId) {
      return;
    }

    try {
      const response = await fetch(`${API_CLIENT_BASE}/teams/active`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId
        },
        body: JSON.stringify({ teamId })
      });
      const output = await response.json();
      if (!response.ok || !output.isValid) {
        throw new Error(output.errorMessages?.join(", ") || "Não foi possível alterar o time ativo.");
      }
      serverActiveTeamIdRef.current = teamId;

      writeTeamsBootstrapCache(supabaseId, {
        teams: teamsRef.current,
        activeTeamId: teamId,
      });
    } catch (err) {
      console.error("Error updating active team:", err);
      throw err;
    }
  }, [storageKey, supabaseId]);

  const completeTeamSwitch = useCallback(() => {
    pendingActiveTeamSwitchRef.current = null;
    setIsSwitchingTeam(false);
    setSwitchingTeamName(null);
    setIsTeamSwitchPersisted(false);
  }, []);

  const revertTeamSwitch = useCallback((previousTeamId: string | null) => {
    pendingActiveTeamSwitchRef.current = null;
    activeTeamIdRef.current = previousTeamId;
    setActiveTeamIdState(previousTeamId);
    setIsSwitchingTeam(false);
    setSwitchingTeamName(null);
    setIsTeamSwitchPersisted(false);

    if (typeof window === "undefined") {
      return;
    }

    if (previousTeamId) {
      window.localStorage.setItem(storageKey, previousTeamId);
      return;
    }

    window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  const setActiveTeamId = useCallback(async (teamId: string) => {
    const targetTeam = teams.find((team) => team.id === teamId);
    if (!teamId || teamId === activeTeamId || !targetTeam) {
      return;
    }

    if (!isTeamSelectable(targetTeam)) {
      toast.error(getTeamBlockedMessage(targetTeam));
      return;
    }

    const previousTeamId = activeTeamIdRef.current;
    const generation = ++teamSwitchGenerationRef.current;
    pendingActiveTeamSwitchRef.current = teamId;

    setIsTeamSwitchPersisted(false);
    setIsSwitchingTeam(true);
    setSwitchingTeamName(targetTeam.name);
    activeTeamIdRef.current = teamId;
    setActiveTeamIdState(teamId);

    try {
      await persistActiveTeam(teamId);
      if (generation !== teamSwitchGenerationRef.current) {
        return;
      }
      setIsTeamSwitchPersisted(true);
    } catch (error) {
      toastUserError(error);
      if (generation !== teamSwitchGenerationRef.current) {
        return;
      }
      revertTeamSwitch(previousTeamId);
    }
  }, [activeTeamId, persistActiveTeam, revertTeamSwitch, teams]);

  useEffect(() => {
    if (!supabaseId) return;
    // Com bootstrap server-side, a primeira execução não precisa refazer o fetch.
    if (hasInitialTeams && !initialFetchSkippedRef.current) {
      initialFetchSkippedRef.current = true;
      return;
    }
    void refreshTeams();
  }, [supabaseId, refreshTeams, hasInitialTeams]);

  useEffect(() => {
    if (initializedRef.current) return;
    if (!serverTeamsReadyRef.current) return;
    if (teams.length === 0) return;

    let nextTeamId: string | null = null;

    if (serverActiveTeamIdRef.current) {
      const serverTeam = teams.find((team) => team.id === serverActiveTeamIdRef.current);
      if (serverTeam && isTeamSelectable(serverTeam)) {
        nextTeamId = serverActiveTeamIdRef.current;
      }
    }

    if (!nextTeamId && typeof window !== "undefined") {
      const stored = window.localStorage.getItem(storageKey);
      const storedTeam = stored ? teams.find((team) => team.id === stored) : null;
      if (stored && storedTeam && isTeamSelectable(storedTeam)) {
        nextTeamId = stored;
      }
    }

    if (!nextTeamId) {
      nextTeamId = teams.find((team) => isTeamSelectable(team))?.id ?? null;
    }

    if (nextTeamId) {
      initializedRef.current = true;
      activeTeamIdRef.current = nextTeamId;
      setActiveTeamIdState(nextTeamId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, nextTeamId);
      }

      if (nextTeamId !== serverActiveTeamIdRef.current) {
        persistActiveTeam(nextTeamId).catch((err) => {
          console.error("Error persisting initial team:", err);
        });
      }
    }
  }, [storageKey, teams, persistActiveTeam]);

  useEffect(() => {
    if (!activeTeamId) return;

    const currentTeam = teams.find((team) => team.id === activeTeamId);
    if (!currentTeam || isTeamSelectable(currentTeam)) {
      return;
    }

    const fallback = teams.find((team) => isTeamSelectable(team))?.id ?? null;
    if (fallback && fallback !== activeTeamId) {
      const blockedTeam = teams.find((team) => team.id === activeTeamId);
      toast.info(
        blockedTeam
          ? getTeamBlockedMessage(blockedTeam)
          : "Esta conta não está acessível. Alternamos para outro time disponível."
      );
      setActiveTeamIdState(fallback);
      persistActiveTeam(fallback).catch((err) => {
        console.error("Error persisting fallback team:", err);
      });
      return;
    }

    if (!fallback) {
      setActiveTeamIdState(null);
    }
  }, [activeTeamId, teams, persistActiveTeam]);

  useEffect(() => {
    if (!activeTeamId) return;
    if (!teams.some((team) => team.id === activeTeamId)) {
      const fallback = teams.find((team) => isTeamSelectable(team))?.id ?? null;
      if (fallback) {
        setActiveTeamIdState(fallback);
        persistActiveTeam(fallback).catch((err) => {
          console.error("Error persisting fallback team:", err);
        });
      }
    }
  }, [activeTeamId, teams, persistActiveTeam]);

  const activeTeam = useMemo(() => {
    return teams.find((team) => team.id === activeTeamId) || null;
  }, [teams, activeTeamId]);

  const activeRole = activeTeam?.role ?? null;
  const activeFunctions = activeTeam?.functions ?? EMPTY_TEAM_FUNCTIONS;
  const isTeamMaster = !!(user && activeTeam && activeTeam.masterId === user.id);

  useEffect(() => {
    if (!activeTeamId || !activeTeam) return;
    if (activeRole === "operator" && activeFunctions.length === 0) {
      toast.info("Seu time atual não possui funções atribuídas.");
    }
  }, [activeTeamId, activeTeam, activeRole, activeFunctions]);

  const value = useMemo<TeamContextState>(() => ({
    teams,
    activeTeamId,
    activeTeam,
    activeRole,
    activeFunctions,
    isTeamMaster,
    isLoading,
    error,
    isSwitchingTeam,
    switchingTeamName,
    isTeamSwitchPersisted,
    refreshTeams,
    setActiveTeamId,
    completeTeamSwitch,
  }), [
    teams,
    activeTeamId,
    activeTeam,
    activeRole,
    activeFunctions,
    isTeamMaster,
    isLoading,
    error,
    isSwitchingTeam,
    switchingTeamName,
    isTeamSwitchPersisted,
    refreshTeams,
    setActiveTeamId,
    completeTeamSwitch,
  ]);

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
};

export const useTeamContext = () => {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error("useTeamContext must be used within a TeamProvider");
  }
  return context;
};

export const useOptionalTeamContext = () => useContext(TeamContext);
