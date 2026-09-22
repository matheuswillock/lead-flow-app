"use client";

import { createContext, useContext } from "react";
import { useWebhooksEntry } from "./WebhooksEntryHook";
import type { WebhooksEntryActions, WebhooksEntryState } from "./WebhooksEntryTypes";

type WebhooksEntryContextValue = WebhooksEntryState & WebhooksEntryActions;

const WebhooksEntryContext = createContext<WebhooksEntryContextValue | null>(null);

interface WebhooksEntryProviderProps {
  supabaseId: string;
  children: React.ReactNode;
}

export function WebhooksEntryProvider({ supabaseId, children }: WebhooksEntryProviderProps) {
  const value = useWebhooksEntry(supabaseId);

  return <WebhooksEntryContext.Provider value={value}>{children}</WebhooksEntryContext.Provider>;
}

export function useWebhooksEntryContext(): WebhooksEntryContextValue {
  const context = useContext(WebhooksEntryContext);
  if (!context) {
    throw new Error("useWebhooksEntryContext must be used within a WebhooksEntryProvider");
  }
  return context;
}
