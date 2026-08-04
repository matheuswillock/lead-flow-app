"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LeadCustomFieldDefinitionDTO } from "@/lib/leadCustomFields/types";

/**
 * Busca as definições ativas de custom fields do time, com dedupe por
 * (supabaseId, teamId) — mesmo padrão de `useTeamMembersByFunction`
 * (stable request key + in-flight guard + last-settled key guard).
 * Erro 5xx/rede também “assenta” a chave para não re-disparar em loop;
 * refresh explícito usa `force: true`.
 */
export function useActiveLeadCustomFieldDefinitions(supabaseId?: string, teamId?: string | null) {
  const [definitions, setDefinitions] = useState<LeadCustomFieldDefinitionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequestKeyRef = useRef<string | null>(null);
  const lastSettledKeyRef = useRef<string | null>(null);
  const inFlightKeyRef = useRef<string | null>(null);

  const loadDefinitions = useCallback(
    async (options?: { force?: boolean }) => {
      if (!supabaseId || !teamId) {
        setDefinitions([]);
        setError(null);
        latestRequestKeyRef.current = null;
        lastSettledKeyRef.current = null;
        inFlightKeyRef.current = null;
        return;
      }

      const requestKey = `${supabaseId}:${teamId}`;
      latestRequestKeyRef.current = requestKey;

      if (
        !options?.force &&
        (inFlightKeyRef.current === requestKey || lastSettledKeyRef.current === requestKey)
      ) {
        return;
      }

      inFlightKeyRef.current = requestKey;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/v1/teams/${teamId}/lead-custom-fields`, {
          headers: { "x-supabase-user-id": supabaseId, "x-team-id": teamId },
        });
        const json = await response.json();
        if (latestRequestKeyRef.current !== requestKey) {
          return;
        }
        if (!response.ok || !json?.isValid) {
          throw new Error(json?.errorMessages?.[0] ?? "Erro ao carregar campos personalizados");
        }
        setDefinitions(
          (json.result as LeadCustomFieldDefinitionDTO[]).filter((def) => def.isActive)
        );
        lastSettledKeyRef.current = requestKey;
      } catch (loadError) {
        if (latestRequestKeyRef.current !== requestKey) {
          return;
        }
        // Assenta a chave mesmo em erro para evitar retry storm em 5xx.
        lastSettledKeyRef.current = requestKey;
        setError(
          loadError instanceof Error ? loadError.message : "Erro ao carregar campos personalizados"
        );
      } finally {
        if (inFlightKeyRef.current === requestKey) {
          inFlightKeyRef.current = null;
        }
        if (latestRequestKeyRef.current === requestKey) {
          setLoading(false);
        }
      }
    },
    [supabaseId, teamId]
  );

  useEffect(() => {
    void loadDefinitions();
  }, [loadDefinitions]);

  const refreshDefinitions = useCallback(() => {
    lastSettledKeyRef.current = null;
    return loadDefinitions({ force: true });
  }, [loadDefinitions]);

  return { definitions, loading, error, refreshDefinitions };
}
