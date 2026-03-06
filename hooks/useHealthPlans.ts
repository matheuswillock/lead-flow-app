"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type HealthPlanOption = {
  id: string;
  name: string;
};

const healthPlanInFlightByKey = new Map<string, Promise<HealthPlanOption[]>>();

export function useHealthPlans(supabaseId?: string, teamId?: string | null) {
  const [healthPlans, setHealthPlans] = useState<HealthPlanOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSuccessKeyRef = useRef<string | null>(null);

  const loadHealthPlans = useCallback(
    async (options?: { force?: boolean }) => {
      if (!supabaseId) {
        setHealthPlans([]);
        setError(null);
        return;
      }

      const requestKey = `${supabaseId}:${teamId ?? ""}`;
      if (!options?.force && lastSuccessKeyRef.current === requestKey) {
        return;
      }

      const existingRequest = healthPlanInFlightByKey.get(requestKey);
      const requestPromise =
        existingRequest ??
        (async (): Promise<HealthPlanOption[]> => {
          const response = await fetch("/api/v1/health-plans", {
            method: "GET",
            headers: {
              "x-supabase-user-id": supabaseId,
              ...(teamId ? { "x-team-id": teamId } : {}),
            },
          });

          const result = await response.json().catch(() => null);
          if (!response.ok || !result?.isValid) {
            const errorMessage =
              result?.errorMessages?.join(", ") || "Erro ao carregar planos de saúde";
            throw new Error(errorMessage);
          }

          return (result.result?.healthPlans || []) as HealthPlanOption[];
        })();

      if (!existingRequest) {
        healthPlanInFlightByKey.set(
          requestKey,
          requestPromise.finally(() => {
            healthPlanInFlightByKey.delete(requestKey);
          })
        );
      }

      setLoading(true);
      setError(null);
      try {
        const plans = await requestPromise;
        setHealthPlans(plans);
        lastSuccessKeyRef.current = requestKey;
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Erro ao carregar planos de saúde");
      } finally {
        setLoading(false);
      }
    },
    [supabaseId, teamId]
  );

  useEffect(() => {
    void loadHealthPlans();
  }, [loadHealthPlans]);

  return {
    healthPlans,
    loading,
    error,
    refreshHealthPlans: () => loadHealthPlans({ force: true }),
  };
}
