"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useInboundWebhookCreateHook } from "./InboundWebhookCreateHook";
import type { InboundWebhookCreateContextValue } from "./InboundWebhookCreateTypes";

const InboundWebhookCreateContext = createContext<InboundWebhookCreateContextValue | null>(null);

type ProviderProps = {
  supabaseId: string;
  children: ReactNode;
};

export function InboundWebhookCreateProvider({ supabaseId, children }: ProviderProps) {
  const value = useInboundWebhookCreateHook(supabaseId);
  return (
    <InboundWebhookCreateContext.Provider value={value}>{children}</InboundWebhookCreateContext.Provider>
  );
}

export function useInboundWebhookCreateContext(): InboundWebhookCreateContextValue {
  const context = useContext(InboundWebhookCreateContext);
  if (!context) {
    throw new Error("useInboundWebhookCreateContext must be used within InboundWebhookCreateProvider");
  }
  return context;
}
