"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { publicLeadFormService } from "../services/PublicLeadFormService";
import type { HealthPlanOption, CloserOption } from "../services/IPublicLeadFormService";
import type { PublicLeadFormState, PublicLeadFormActions } from "./PublicLeadFormTypes";

export function usePublicLeadForm(supabaseId: string, teamId: string): PublicLeadFormState & PublicLeadFormActions {
  const [healthPlans, setHealthPlans] = useState<HealthPlanOption[]>([]);
  const [healthPlansLoading, setHealthPlansLoading] = useState(true);
  const [closers, setClosers] = useState<CloserOption[]>([]);
  const [closersLoading, setClosersLoading] = useState(true);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const bootstrapInFlightKeyRef = useRef<string | null>(null);
  const bootstrapLastSuccessKeyRef = useRef<string | null>(null);
  const availabilityInFlightKeyRef = useRef<string | null>(null);
  const lastAvailabilitySuccessKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabaseId || !teamId) return;
    const requestKey = `${supabaseId}:${teamId}`;
    if (bootstrapLastSuccessKeyRef.current === requestKey) return;
    if (bootstrapInFlightKeyRef.current === requestKey) return;

    bootstrapInFlightKeyRef.current = requestKey;

    const load = async () => {
      setHealthPlansLoading(true);
      setClosersLoading(true);
      try {
        const bootstrapData = await publicLeadFormService.getBootstrapData(supabaseId, teamId);
        if (bootstrapInFlightKeyRef.current !== requestKey) {
          return;
        }

        setHealthPlans(bootstrapData.healthPlans);
        setClosers(bootstrapData.closers);
        bootstrapLastSuccessKeyRef.current = requestKey;
      } catch (error) {
        if (bootstrapInFlightKeyRef.current !== requestKey) {
          return;
        }
        console.error("[usePublicLeadForm] Erro ao carregar bootstrap inicial:", error);
      } finally {
        if (bootstrapInFlightKeyRef.current === requestKey) {
          bootstrapInFlightKeyRef.current = null;
          setHealthPlansLoading(false);
          setClosersLoading(false);
        }
      }
    };

    load();
  }, [supabaseId, teamId]);

  const fetchAvailability = useCallback(
    async (closerId: string, date: string) => {
      if (!closerId || !date) {
        availabilityInFlightKeyRef.current = null;
        setAvailabilityLoading(false);
        setAvailableTimes([]);
        lastAvailabilitySuccessKeyRef.current = null;
        return;
      }

      const requestKey = `${supabaseId}:${teamId}:${closerId}:${date}`;
      if (lastAvailabilitySuccessKeyRef.current === requestKey) {
        return;
      }
      if (availabilityInFlightKeyRef.current === requestKey) {
        return;
      }

      availabilityInFlightKeyRef.current = requestKey;
      setAvailabilityLoading(true);

      try {
        const result = await publicLeadFormService.getAvailability(supabaseId, teamId, closerId, date);
        if (availabilityInFlightKeyRef.current !== requestKey) {
          return;
        }
        setAvailableTimes(result.availableTimes);
        lastAvailabilitySuccessKeyRef.current = requestKey;
      } catch (error) {
        if (availabilityInFlightKeyRef.current !== requestKey) {
          return;
        }
        console.error("[usePublicLeadForm] Erro ao buscar disponibilidade:", error);
        setAvailableTimes([]);
      } finally {
        if (availabilityInFlightKeyRef.current === requestKey) {
          availabilityInFlightKeyRef.current = null;
          setAvailabilityLoading(false);
        }
      }
    },
    [supabaseId, teamId]
  );

  const submitLead = useCallback(
    async (data: Parameters<PublicLeadFormActions["submitLead"]>[0]) => {
      setIsSubmitting(true);
      try {
        const result = await publicLeadFormService.submitLead({
          supabaseId,
          teamId,
          ...data,
        });
        if (result.isValid) {
          setIsSubmitted(true);
        }
        return result;
      } finally {
        setIsSubmitting(false);
      }
    },
    [supabaseId, teamId]
  );

  const resetForm = useCallback(() => {
    setIsSubmitted(false);
    setAvailableTimes([]);
  }, []);

  return {
    supabaseId,
    teamId,
    healthPlans,
    healthPlansLoading,
    closers,
    closersLoading,
    availableTimes,
    availabilityLoading,
    isSubmitting,
    isSubmitted,
    fetchAvailability,
    submitLead,
    resetForm,
  };
}
