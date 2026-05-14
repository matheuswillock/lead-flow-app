"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isManagerLikeRole } from "@/lib/roles";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUserContext } from "@/app/context/UserContext";
import type { IPmeSimulatorService } from "../services/IPmeSimulatorService";
import type { PmeHospitalId, PmeSimulationOutput, PmeSimulatorCatalog, PmeSimulatorContextValue } from "./PmeSimulatorTypes";

const DEFAULT_HOSPITAL_ID: PmeHospitalId = "nenhum";

function parseAges(input: string): number[] {
  return input
    .split(/[,;\s]+/)
    .map((item) => Number(item.trim()))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 99);
}

export function usePmeSimulatorHook(service: IPmeSimulatorService): PmeSimulatorContextValue {
  const { user } = useUserContext();
  const { activeTeamId, activeFunctions } = useTeamContext();

  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isSimulationLoading, setIsSimulationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<PmeSimulatorCatalog | null>(null);
  const [ages, setAges] = useState<number[]>([]);
  const [ageInput, setAgeInput] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState<PmeHospitalId>(DEFAULT_HOSPITAL_ID);
  const [simulation, setSimulation] = useState<PmeSimulationOutput | null>(null);
  const [expandedPlanIds, setExpandedPlanIds] = useState<string[]>([]);

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
    if (ages.length === 0) {
      setSimulation(null);
      return;
    }

    try {
      setIsSimulationLoading(true);
      setError(null);
      const output = await service.simulate({
        supabaseId: user.supabaseId,
        teamId: activeTeamId,
        ages,
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
  }, [activeTeamId, ages, isAllowed, selectedHospitalId, service, user?.supabaseId]);

  const addAgesFromInput = useCallback(() => {
    const parsed = parseAges(ageInput);
    if (parsed.length === 0) {
      return;
    }
    setAges((current) => [...current, ...parsed].sort((a, b) => a - b));
    setAgeInput("");
  }, [ageInput]);

  const removeAgeByIndex = useCallback((index: number) => {
    setAges((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const clearAges = useCallback(() => {
    setAges([]);
    setAgeInput("");
    setSimulation(null);
    setExpandedPlanIds([]);
  }, []);

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
    if (ages.length === 0) {
      setSimulation(null);
      setExpandedPlanIds([]);
      return;
    }
    void runSimulation();
  }, [ages, selectedHospitalId, runSimulation]);

  return {
    isCatalogLoading,
    isSimulationLoading,
    isAllowed,
    error,
    catalogs,
    ages,
    ageInput,
    selectedHospitalId,
    simulation,
    expandedPlanIds,
    setAgeInput,
    addAgesFromInput,
    removeAgeByIndex,
    clearAges,
    selectHospital,
    runSimulation,
    togglePlan,
  };
}

