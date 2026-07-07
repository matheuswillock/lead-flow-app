"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LeadCustomFieldDefinitionDTO } from "@/lib/leadCustomFields/types";

type UseLeadCustomFieldDefinitionsOptions = {
  teamId?: string | null;
  supabaseId?: string;
  includeInactive?: boolean;
};

export function useLeadCustomFieldDefinitions({
  teamId,
  supabaseId,
  includeInactive = false,
}: UseLeadCustomFieldDefinitionsOptions) {
  const [definitions, setDefinitions] = useState<LeadCustomFieldDefinitionDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightKeyRef = useRef<string | null>(null);
  const lastSuccessKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!teamId || !supabaseId) {
      setDefinitions([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const requestKey = `${teamId}:${includeInactive ? "all" : "active"}`;
    if (inFlightKeyRef.current === requestKey || lastSuccessKeyRef.current === requestKey) {
      return;
    }

    let cancelled = false;
    inFlightKeyRef.current = requestKey;
    setIsLoading(true);
    setError(null);

    const query = includeInactive ? "?includeInactive=true" : "";

    fetch(`/api/v1/teams/${teamId}/lead-custom-fields${query}`, {
      headers: {
        "x-supabase-user-id": supabaseId,
        "x-team-id": teamId,
      },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.isValid) {
          throw new Error(payload?.errorMessages?.[0] || "Erro ao carregar campos personalizados");
        }
        if (!cancelled) {
          setDefinitions(Array.isArray(payload.result) ? payload.result : []);
          lastSuccessKeyRef.current = requestKey;
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setDefinitions([]);
          setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar campos personalizados");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          inFlightKeyRef.current = null;
        }
      });

    return () => {
      cancelled = true;
      if (inFlightKeyRef.current === requestKey) {
        inFlightKeyRef.current = null;
      }
    };
  }, [teamId, supabaseId, includeInactive]);

  const refresh = useCallback(() => {
    lastSuccessKeyRef.current = null;
    if (!teamId || !supabaseId) return;
    const requestKey = `${teamId}:${includeInactive ? "all" : "active"}`;
    inFlightKeyRef.current = null;
    setIsLoading(true);
    setError(null);
    void fetch(`/api/v1/teams/${teamId}/lead-custom-fields${includeInactive ? "?includeInactive=true" : ""}`, {
      headers: {
        "x-supabase-user-id": supabaseId,
        "x-team-id": teamId,
      },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.isValid) {
          throw new Error(payload?.errorMessages?.[0] || "Erro ao carregar campos personalizados");
        }
        setDefinitions(Array.isArray(payload.result) ? payload.result : []);
        lastSuccessKeyRef.current = requestKey;
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar campos personalizados");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [teamId, supabaseId, includeInactive]);

  const activeDefinitions = useMemo(
    () => definitions.filter((definition) => definition.isActive),
    [definitions]
  );

  return {
    definitions,
    activeDefinitions,
    isLoading,
    error,
    refresh,
  };
}
