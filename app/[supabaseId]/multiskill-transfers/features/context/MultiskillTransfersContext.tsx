"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useParams } from "next/navigation";
import type { IMultiskillTransfersContext } from "./MultiskillTransfersTypes";
import { useMultiskillTransfersHook } from "./MultiskillTransfersHook";
import { multiskillTransfersService } from "../services/MultiskillTransfersService";

const MultiskillTransfersContext = createContext<IMultiskillTransfersContext | undefined>(
  undefined
);

export function MultiskillTransfersProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const state = useMultiskillTransfersHook({
    supabaseId,
    service: multiskillTransfersService,
  });

  return (
    <MultiskillTransfersContext.Provider value={state}>
      {children}
    </MultiskillTransfersContext.Provider>
  );
}

export function useMultiskillTransfersContext(): IMultiskillTransfersContext {
  const context = useContext(MultiskillTransfersContext);
  if (!context) {
    throw new Error("useMultiskillTransfersContext must be used inside MultiskillTransfersProvider");
  }
  return context;
}
