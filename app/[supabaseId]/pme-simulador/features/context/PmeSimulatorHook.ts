"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isManagerLikeRole } from "@/lib/roles";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUserContext } from "@/app/context/UserContext";
import { deserializeAgeRanges, getTotalBeneficiaries } from "@/lib/ageRanges";
import type { IPmeSimulatorService } from "../services/IPmeSimulatorService";
import type { PmeHospitalId, PmeSimulationOutput, PmeSimulatorCatalog, PmeSimulatorContextValue } from "./PmeSimulatorTypes";

const DEFAULT_HOSPITAL_ID: PmeHospitalId = "nenhum";

export function usePmeSimulatorHook(service: IPmeSimulatorService): PmeSimulatorContextValue {
  const { user } = useUserContext();
  const { activeTeamId, activeFunctions } = useTeamContext();

  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isSimulationLoading, setIsSimulationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<PmeSimulatorCatalog | null>(null);
  const [serializedAgeRanges, setSerializedAgeRanges] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState<PmeHospitalId>(DEFAULT_HOSPITAL_ID);
  const [simulation, setSimulation] = useState<PmeSimulationOutput | null>(null);
  const [expandedPlanIds, setExpandedPlanIds] = useState<string[]>([]);

  const ageRangeCounts = useMemo(
    () => deserializeAgeRanges(serializedAgeRanges),
    [serializedAgeRanges],
  );

  const totalLives = useMemo(
    () => getTotalBeneficiaries(ageRangeCounts),
    [ageRangeCounts],
  );

  const totalFaixas = useMemo(
    () => ageRangeCounts.filter((r) => r.count > 0).length,
    [ageRangeCounts],
  );

  const isAllowed = useMemo(() => {
    if (!user) {
      return false;
    }
    if (isManagerLikeRole(user.role)) {
      return true;
    }
    return activeFunctions.includes("SDR") || activeFunctions.includes("CLOSER");
  }, [activeFunctions, user]);

  const loadCatalog = useCallback(async () => {
    if (!user?.supabaseId || !activeTeamId || !isAllowed) {
      return;
    }

    try {
      setIsCatalogLoading(true);
      setError(null);
      const result = await service.getCatalog({
        supabaseId: user.supabaseId,
        teamId: activeTeamId,
      });
      setCatalogs(result);
      const hasHospital = result.hospitals.some((item) => item.id === selectedHospitalId);
      if (!hasHospital && result.hospitals[0]) {
        setSelectedHospitalId(result.hospitals[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar catalogo.";
      setError(message);
    } finally {
      setIsCatalogLoading(false);
    }
  }, [activeTeamId, isAllowed, selectedHospitalId, service, user?.supabaseId]);

  const runSimulation = useCallback(async () => {
    if (!user?.supabaseId || !activeTeamId || !isAllowed) {
      return;
    }
    if (totalLives === 0) {
      setSimulation(null);
      return;
    }

    try {
      setIsSimulationLoading(true);
      setError(null);
      const output = await service.simulateFromRangeCounts({
        supabaseId: user.supabaseId,
        teamId: activeTeamId,
        ageRangeCounts,
        hospitalId: selectedHospitalId,
      });
      setSimulation(output);
      setExpandedPlanIds([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao executar simulacao.";
      setError(message);
    } finally {
      setIsSimulationLoading(false);
    }
  }, [activeTeamId, ageRangeCounts, isAllowed, selectedHospitalId, service, totalLives, user?.supabaseId]);

  const selectHospital = useCallback((hospitalId: PmeHospitalId) => {
    setSelectedHospitalId(hospitalId);
  }, []);

  const togglePlan = useCallback((planId: string) => {
    setExpandedPlanIds((current) =>
      current.includes(planId) ? current.filter((item) => item !== planId) : [...current, planId],
    );
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (totalLives === 0) {
      setSimulation(null);
      setExpandedPlanIds([]);
    }
  }, [totalLives]);

  return {
    isCatalogLoading,
    isSimulationLoading,
    isAllowed,
    error,
    catalogs,
    ageRangeCounts,
    serializedAgeRanges,
    selectedHospitalId,
    simulation,
    expandedPlanIds,
    totalFaixas,
    setSerializedAgeRanges,
    selectHospital,
    runSimulation,
    togglePlan,
  };
}

