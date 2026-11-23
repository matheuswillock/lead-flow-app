"use client";

import { createContext, useContext } from "react";
import type { IPlanSimulatorService } from "../services/IPlanSimulatorService";
import { planSimulatorService } from "../services/PlanSimulatorService";
import { usePlanSimulatorHook, type PlanSimulatorHookValue } from "./PlanSimulatorHook";

const PlanSimulatorContext = createContext<PlanSimulatorHookValue | undefined>(undefined);

export function PlanSimulatorProvider({
  children,
  service = planSimulatorService,
}: {
  children: React.ReactNode;
  service?: IPlanSimulatorService;
}) {
  const value = usePlanSimulatorHook(service);
  return <PlanSimulatorContext.Provider value={value}>{children}</PlanSimulatorContext.Provider>;
}

export function usePlanSimulatorContext(): PlanSimulatorHookValue {
  const context = useContext(PlanSimulatorContext);
  if (!context) throw new Error("usePlanSimulatorContext deve ser usado dentro de PlanSimulatorProvider");
  return context;
}
