"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useOutboundWebhookCreateHook } from "./OutboundWebhookCreateHook";
import type { OutboundWebhookCreateContextValue } from "./OutboundWebhookCreateTypes";

const OutboundWebhookCreateContext = createContext<OutboundWebhookCreateContextValue | null>(null);

type ProviderProps = {
  supabaseId: string;
  children: ReactNode;
};

export function OutboundWebhookCreateProvider({ supabaseId, children }: ProviderProps) {
  const value = useOutboundWebhookCreateHook(supabaseId);
  return (
    <OutboundWebhookCreateContext.Provider value={value}>{children}</OutboundWebhookCreateContext.Provider>
  );
}

export function useOutboundWebhookCreateContext(): OutboundWebhookCreateContextValue {
  const context = useContext(OutboundWebhookCreateContext);
  if (!context) {
    throw new Error("useOutboundWebhookCreateContext must be used within OutboundWebhookCreateProvider");
  }
  return context;
}
