"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { teamScheduleSettingsService } from "../services/TeamScheduleSettingsService";
import type { TeamMeetingDurationMinutes, TeamScheduleSettings } from "../types";

type TeamScheduleSettingsContextValue = {
  settings: TeamScheduleSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveError: string | null;
  saveFeedback: string | null;
  retry: () => Promise<void>;
  save: (durationMinutes: TeamMeetingDurationMinutes) => Promise<void>;
};

const TeamScheduleSettingsContext = createContext<TeamScheduleSettingsContextValue | null>(null);

export function TeamScheduleSettingsProvider({
  children,
  supabaseId,
  teamId,
}: {
  children: ReactNode;
  supabaseId: string;
  teamId: string;
}) {
  const [settings, setSettings] = useState<TeamScheduleSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const requestKeyRef = useRef("");

  const load = useCallback(async () => {
    const requestKey = `${supabaseId}:${teamId}`;
    requestKeyRef.current = requestKey;
    setIsLoading(true);
    setError(null);
    try {
      const result = await teamScheduleSettingsService.get({ supabaseId, teamId });
      if (requestKeyRef.current === requestKey) setSettings(result);
    } catch {
      if (requestKeyRef.current === requestKey) {
        setError("Não foi possível carregar a configuração de horários.");
      }
    } finally {
      if (requestKeyRef.current === requestKey) setIsLoading(false);
    }
  }, [supabaseId, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (durationMinutes: TeamMeetingDurationMinutes) => {
      setIsSaving(true);
      setSaveError(null);
      setSaveFeedback("Salvando a configuração de horários...");
      try {
        const result = await teamScheduleSettingsService.update({ supabaseId, teamId, durationMinutes });
        setSettings(result);
        setSaveFeedback("Configuração de horários salva.");
        toast.success("Duração de reunião atualizada.");
      } catch {
        const safeMessage = "Não foi possível salvar a configuração de horários.";
        setSaveError(safeMessage);
        setSaveFeedback("Não foi possível salvar a configuração de horários.");
        toastUserError(new Error(safeMessage));
      } finally {
        setIsSaving(false);
      }
    },
    [supabaseId, teamId]
  );

  return (
    <TeamScheduleSettingsContext.Provider
      value={{ settings, isLoading, isSaving, error, saveError, saveFeedback, retry: load, save }}
    >
      {children}
    </TeamScheduleSettingsContext.Provider>
  );
}

export function useTeamScheduleSettings() {
  const context = useContext(TeamScheduleSettingsContext);
  if (!context) throw new Error("useTeamScheduleSettings deve ser usado dentro de TeamScheduleSettingsProvider.");
  return context;
}
