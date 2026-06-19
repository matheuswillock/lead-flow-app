"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { publicLeadFormService } from "../services/PublicLeadFormService";
import type {
  HealthPlanOption,
  CloserOption,
  SdrOption,
  GuestCandidateOption,
} from "../services/IPublicLeadFormService";
import type { PublicLeadFormState, PublicLeadFormActions, BootstrapStatus } from "./PublicLeadFormTypes";
import { DEFAULT_TZ } from "@/lib/dates";

export function usePublicLeadForm(teamId: string, legacySupabaseId?: string): PublicLeadFormState & PublicLeadFormActions {
  const [teamName, setTeamName] = useState("");
  const [healthPlans, setHealthPlans] = useState<HealthPlanOption[]>([]);
  const [healthPlansLoading, setHealthPlansLoading] = useState(true);
  const [closers, setClosers] = useState<CloserOption[]>([]);
  const [closersLoading, setClosersLoading] = useState(true);
  const [sdrs, setSdrs] = useState<SdrOption[]>([]);
  const [guestCandidates, setGuestCandidates] = useState<GuestCandidateOption[]>([]);
  const [timezone, setTimezone] = useState(DEFAULT_TZ);
  const [hasTransferTargets, setHasTransferTargets] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus>("loading");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [preScheduleOccupiedSlots, setPreScheduleOccupiedSlots] = useState<number[]>([]);
  const [preScheduleSlotsLoading, setPreScheduleSlotsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [bootstrapRetryCount, setBootstrapRetryCount] = useState(0);

  const bootstrapInFlightKeyRef = useRef<string | null>(null);
  const availabilityInFlightKeyRef = useRef<string | null>(null);
  const lastAvailabilitySuccessKeyRef = useRef<string | null>(null);
  const preScheduleSlotsInFlightKeyRef = useRef<string | null>(null);
  const lastPreScheduleSlotsSuccessKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!teamId) {
      setBootstrapStatus("error");
      setBootstrapError("Time inválido para carregar o formulário.");
      setHealthPlansLoading(false);
      setClosersLoading(false);
      return;
    }

    const requestKey = `${teamId}:${legacySupabaseId ?? "legacy-none"}`;
    if (bootstrapInFlightKeyRef.current === requestKey) return;

    bootstrapInFlightKeyRef.current = requestKey;

    const load = async () => {
      setBootstrapStatus("loading");
      setBootstrapError(null);
      setHealthPlansLoading(true);
      setClosersLoading(true);

      try {
        const bootstrapData = await publicLeadFormService.getBootstrapData(teamId, legacySupabaseId);
        if (bootstrapInFlightKeyRef.current !== requestKey) {
          return;
        }

        setTeamName(bootstrapData.teamName);
        setHealthPlans(bootstrapData.healthPlans);
        setClosers(bootstrapData.closers);
        setSdrs(bootstrapData.sdrs);
        setGuestCandidates(bootstrapData.guestCandidates);
        setTimezone(bootstrapData.timezone);
        setHasTransferTargets(bootstrapData.hasTransferTargets);
        setBootstrapStatus("ready");
      } catch (error) {
        if (bootstrapInFlightKeyRef.current !== requestKey) {
          return;
        }
        console.error("[usePublicLeadForm] Erro ao carregar bootstrap inicial:", error);
        setTeamName("");
        setHealthPlans([]);
        setClosers([]);
        setSdrs([]);
        setGuestCandidates([]);
        setTimezone(DEFAULT_TZ);
        setHasTransferTargets(false);
        setBootstrapStatus("error");
        setBootstrapError(
          error instanceof Error ? error.message : "Erro ao carregar dados iniciais do formulário."
        );
      } finally {
        if (bootstrapInFlightKeyRef.current === requestKey) {
          bootstrapInFlightKeyRef.current = null;
          setHealthPlansLoading(false);
          setClosersLoading(false);
        }
      }
    };

    void load();
  }, [teamId, legacySupabaseId, bootstrapRetryCount]);

  const fetchAvailability = useCallback(
    async (closerId: string, date: string) => {
      if (!closerId || !date) {
        availabilityInFlightKeyRef.current = null;
        setAvailabilityLoading(false);
        setAvailableTimes([]);
        lastAvailabilitySuccessKeyRef.current = null;
        return;
      }

      const requestKey = `${teamId}:${closerId}:${date}`;
      if (lastAvailabilitySuccessKeyRef.current === requestKey) {
        return;
      }
      if (availabilityInFlightKeyRef.current === requestKey) {
        return;
      }

      availabilityInFlightKeyRef.current = requestKey;
      setAvailabilityLoading(true);

      try {
        const result = await publicLeadFormService.getAvailability(teamId, closerId, date, legacySupabaseId);
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
    [teamId, legacySupabaseId]
  );

  const submitLead = useCallback(
    async (data: Parameters<PublicLeadFormActions["submitLead"]>[0]) => {
      setIsSubmitting(true);
      try {
        const result = await publicLeadFormService.submitLead({
          teamId,
          supabaseId: legacySupabaseId,
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
    [teamId, legacySupabaseId]
  );

  const fetchPreScheduleSlots = useCallback(
    async (date: string) => {
      if (!date) {
        preScheduleSlotsInFlightKeyRef.current = null;
        setPreScheduleSlotsLoading(false);
        setPreScheduleOccupiedSlots([]);
        lastPreScheduleSlotsSuccessKeyRef.current = null;
        return;
      }

      const requestKey = `${teamId}:${date}`;
      if (lastPreScheduleSlotsSuccessKeyRef.current === requestKey) {
        return;
      }
      if (preScheduleSlotsInFlightKeyRef.current === requestKey) {
        return;
      }

      preScheduleSlotsInFlightKeyRef.current = requestKey;
      setPreScheduleSlotsLoading(true);

      try {
        const result = await publicLeadFormService.getPreScheduleSlots(teamId, date, legacySupabaseId);
        if (preScheduleSlotsInFlightKeyRef.current !== requestKey) {
          return;
        }
        setPreScheduleOccupiedSlots(result.occupiedSlots);
        lastPreScheduleSlotsSuccessKeyRef.current = requestKey;
      } catch (error) {
        if (preScheduleSlotsInFlightKeyRef.current !== requestKey) {
          return;
        }
        console.error("[usePublicLeadForm] Erro ao buscar slots de pré-agendamento:", error);
        setPreScheduleOccupiedSlots([]);
      } finally {
        if (preScheduleSlotsInFlightKeyRef.current === requestKey) {
          preScheduleSlotsInFlightKeyRef.current = null;
          setPreScheduleSlotsLoading(false);
        }
      }
    },
    [teamId, legacySupabaseId]
  );

  const retryBootstrap = useCallback(() => {
    setBootstrapRetryCount((previous) => previous + 1);
  }, []);

  const resetForm = useCallback(() => {
    setIsSubmitted(false);
    setAvailableTimes([]);
    setPreScheduleOccupiedSlots([]);
    lastPreScheduleSlotsSuccessKeyRef.current = null;
  }, []);

  return {
    teamId,
    teamName,
    legacySupabaseId,
    bootstrapStatus,
    bootstrapError,
    healthPlans,
    healthPlansLoading,
    closers,
    closersLoading,
    sdrs,
    guestCandidates,
    timezone,
    hasTransferTargets,
    availableTimes,
    availabilityLoading,
    preScheduleOccupiedSlots,
    preScheduleSlotsLoading,
    isSubmitting,
    isSubmitted,
    fetchAvailability,
    fetchPreScheduleSlots,
    submitLead,
    retryBootstrap,
    resetForm,
  };
}
