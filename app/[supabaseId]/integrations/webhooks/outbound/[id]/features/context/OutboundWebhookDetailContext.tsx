"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useOutboundWebhookDetailHook } from "./OutboundWebhookDetailHook";
import type { OutboundWebhookDetailContextValue } from "./OutboundWebhookDetailTypes";

const OutboundWebhookDetailContext = createContext<OutboundWebhookDetailContextValue | null>(null);

type ProviderProps = {
  supabaseId: string;
  webhookId: string;
  children: ReactNode;
};

export function OutboundWebhookDetailProvider({ supabaseId, webhookId, children }: ProviderProps) {
  const value = useOutboundWebhookDetailHook(supabaseId, webhookId);
  return (
    <OutboundWebhookDetailContext.Provider value={value}>{children}</OutboundWebhookDetailContext.Provider>
  );
}

export function useOutboundWebhookDetailContext(): OutboundWebhookDetailContextValue {
  const context = useContext(OutboundWebhookDetailContext);
  if (!context) {
    throw new Error("useOutboundWebhookDetailContext must be used within OutboundWebhookDetailProvider");
  }
  return context;
}
