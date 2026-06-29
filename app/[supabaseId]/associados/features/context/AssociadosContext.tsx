'use client';

import { createContext, useContext, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useTeamContext } from "@/app/context/TeamContext";
import type { IAssociadosContext } from "./AssociadosTypes";
import { useAssociadosHook } from "./AssociadosHook";
import { associadosService } from "../services/AssociadosService";

const AssociadosContext = createContext<IAssociadosContext | undefined>(undefined);

export function AssociadosProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();
  const state = useAssociadosHook({
    supabaseId,
    teamId: activeTeamId,
    service: associadosService,
  });

  return (
    <AssociadosContext.Provider value={state}>
      {children}
    </AssociadosContext.Provider>
  );
}

export function useAssociadosContext(): IAssociadosContext {
  const context = useContext(AssociadosContext);
  if (!context) {
    throw new Error("useAssociadosContext must be used inside AssociadosProvider");
  }
  return context;
}
