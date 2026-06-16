"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { usePublicScheduleShare } from "./PublicScheduleShareHook";
import type { IPublicScheduleShareContext } from "./PublicScheduleShareTypes";

const PublicScheduleShareContext = createContext<IPublicScheduleShareContext | null>(null);

export function PublicScheduleShareContextProvider({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  const value = usePublicScheduleShare(token);

  return (
    <PublicScheduleShareContext.Provider value={value}>
      {children}
    </PublicScheduleShareContext.Provider>
  );
}

export function usePublicScheduleShareContext() {
  const context = useContext(PublicScheduleShareContext);
  if (!context) {
    throw new Error("usePublicScheduleShareContext deve ser usado dentro do provider.");
  }
  return context;
}
