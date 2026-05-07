"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Output } from "@/lib/output";
import { toast } from "sonner";
import { useUser } from "@/app/context/UserContext";

const teamsInFlightBySupabaseId = new Map<string, Promise<Output>>();

export interface TeamSummary {
  id: string;
  name: string;
  masterId: string;
  isDefault: boolean;
  role: "manager" | "backoffice" | "operator";
  functions: ("SDR" | "CLOSER")[];
  membershipCreatedAt: string;
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

const STORAGE_KEY = "activeTeamId";

interface TeamProviderProps {
  children: React.ReactNode;
  supabaseId: string;
}

export const TeamProvider = ({ children, supabaseId }: TeamProviderProps) => {
  const { user } = useUser();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const serverActiveTeamIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  const refreshTeams = useCallback(async () => {
    if (!supabaseId) {
      return;
    }

    try {
      setIsLoading(true);
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
    } catch (err) {
      console.error("Error fetching teams:", err);
      setError("Network error while fetching teams");
    } finally {
      setIsLoading(false);
    }
  }, [supabaseId]);

  const persistActiveTeam = useCallback(async (teamId: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, teamId);
    }

    if (serverActiveTeamIdRef.current === teamId) {
      return;
    }

    try {
      await fetch("/api/v1/teams/active", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId
        },
        body: JSON.stringify({ teamId })
      });
      serverActiveTeamIdRef.current = teamId;
    } catch (err) {
      console.error("Error updating active team:", err);
    }
  }, [supabaseId]);

  const setActiveTeamId = useCallback(async (teamId: string) => {
    if (!teamId || teamId === activeTeamId) {
      return;
    }

    setActiveTeamIdState(teamId);
    await persistActiveTeam(teamId);
  }, [activeTeamId, persistActiveTeam]);

  useEffect(() => {
    if (!supabaseId) return;
    void refreshTeams();
  }, [supabaseId, refreshTeams]);

  useEffect(() => {
    if (initializedRef.current) return;
    if (teams.length === 0) return;

    let nextTeamId: string | null = null;

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && teams.some((team) => team.id === stored)) {
        nextTeamId = stored;
      }
    }

    if (!nextTeamId && serverActiveTeamIdRef.current) {
      const serverTeamId = serverActiveTeamIdRef.current;
      if (teams.some((team) => team.id === serverTeamId)) {
        nextTeamId = serverTeamId;
      }
    }

    if (!nextTeamId) {
      nextTeamId = teams[0]?.id ?? null;
    }

    if (nextTeamId) {
      initializedRef.current = true;
      setActiveTeamIdState(nextTeamId);
      persistActiveTeam(nextTeamId).catch((err) => {
        console.error("Error persisting initial team:", err);
      });
    }
  }, [teams, persistActiveTeam]);

  useEffect(() => {
    if (!activeTeamId) return;
    if (!teams.some((team) => team.id === activeTeamId)) {
      const fallback = teams[0]?.id ?? null;
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
      toast.info("Seu time atual nao possui funcoes atribuídas.");
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
