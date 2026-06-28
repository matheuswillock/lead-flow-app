"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Output } from "@/lib/output";
import { toast } from "sonner";
import { useUser } from "@/app/context/UserContext";
import {
  readTeamsBootstrapCache,
  writeTeamsBootstrapCache,
} from "@/lib/bootstrap/sessionBootstrapCache";

const teamsInFlightBySupabaseId = new Map<string, Promise<Output>>();

export interface TeamSummary {
  id: string;
  name: string;
  masterId: string;
  accountMasterId?: string;
  accountName?: string;
  isOwnAccount?: boolean;
  isAccessible?: boolean;
  accountSubscriptionActive?: boolean;
  isDefault: boolean;
  role: "manager" | "backoffice" | "operator";
  functions: ("SDR" | "CLOSER")[];
  canCreateAccountUsers: boolean;
  canManageAccountTeams: boolean;
  canTransferAccountLeads: boolean;
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
  refreshTeams: () => Promise<void>;
  setActiveTeamId: (teamId: string) => Promise<void>;
}

const TeamContext = createContext<TeamContextState | undefined>(undefined);

function getStorageKey(supabaseId: string) {
  return `activeTeamId:${supabaseId}`;
}

function isTeamSelectable(team: TeamSummary) {
  return !team.isPending && team.isAccessible !== false;
}

interface TeamProviderProps {
  children: React.ReactNode;
  supabaseId: string;
}

export const TeamProvider = ({ children, supabaseId }: TeamProviderProps) => {
  const { user } = useUser();
  const storageKey = getStorageKey(supabaseId);

  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const serverActiveTeamIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const bootstrapHydratedRef = useRef(false);

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
        const response = await fetch("/api/v1/teams", {
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
      setTeams(payload.teams || []);
      serverActiveTeamIdRef.current = payload.activeTeamId ?? null;

      writeTeamsBootstrapCache(supabaseId, {
        teams: payload.teams || [],
        activeTeamId: payload.activeTeamId ?? null,
      });

      if (payload.activeTeamId && payload.activeTeamId !== activeTeamId) {
        setActiveTeamIdState(payload.activeTeamId);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(storageKey, payload.activeTeamId);
        }
      }
    } catch (err) {
      console.error("Error fetching teams:", err);
      setError("Network error while fetching teams");
    } finally {
      setIsLoading(false);
    }
  }, [activeTeamId, storageKey, supabaseId]);

  const persistActiveTeam = useCallback(async (teamId: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, teamId);
    }

    if (serverActiveTeamIdRef.current === teamId) {
      return;
    }

    try {
      const response = await fetch("/api/v1/teams/active", {
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
    } catch (err) {
      console.error("Error updating active team:", err);
      throw err;
    }
  }, [storageKey, supabaseId]);

  const setActiveTeamId = useCallback(async (teamId: string) => {
    const targetTeam = teams.find((team) => team.id === teamId);
    if (!teamId || teamId === activeTeamId || !targetTeam) {
      return;
    }

    if (!isTeamSelectable(targetTeam)) {
      toast.error("A assinatura desta conta está inativa. Entre em contato com o administrador.");
      return;
    }

    setActiveTeamIdState(teamId);
    try {
      await persistActiveTeam(teamId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar o time ativo.");
    }
  }, [activeTeamId, persistActiveTeam, teams]);

  useEffect(() => {
    if (!supabaseId) return;
    void refreshTeams();
  }, [supabaseId, refreshTeams]);

  useEffect(() => {
    if (initializedRef.current) return;
    if (teams.length === 0) return;

    let nextTeamId: string | null = null;

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(storageKey);
      const storedTeam = stored ? teams.find((team) => team.id === stored) : null;
      if (stored && storedTeam && isTeamSelectable(storedTeam)) {
        nextTeamId = stored;
      }
    }

    if (!nextTeamId && serverActiveTeamIdRef.current) {
      const serverTeamId = serverActiveTeamIdRef.current;
      const serverTeam = teams.find((team) => team.id === serverTeamId);
      if (serverTeam && isTeamSelectable(serverTeam)) {
        nextTeamId = serverTeamId;
      }
    }

    if (!nextTeamId) {
      nextTeamId = teams.find((team) => isTeamSelectable(team))?.id ?? null;
    }

    if (nextTeamId) {
      initializedRef.current = true;
      setActiveTeamIdState(nextTeamId);
      persistActiveTeam(nextTeamId).catch((err) => {
        console.error("Error persisting initial team:", err);
      });
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
      toast.info("A assinatura desta conta está inativa. Alternamos para outro time disponível.");
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
  const activeFunctions = activeTeam?.functions ?? [];
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
    refreshTeams,
    setActiveTeamId
  }), [
    teams,
    activeTeamId,
    activeTeam,
    activeRole,
    activeFunctions,
    isTeamMaster,
    isLoading,
    error,
    refreshTeams,
    setActiveTeamId
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
