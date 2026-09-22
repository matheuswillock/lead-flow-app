"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useInboundWebhookDetailHook } from "./InboundWebhookDetailHook";
import type { InboundWebhookDetailContextValue } from "./InboundWebhookDetailTypes";

const InboundWebhookDetailContext = createContext<InboundWebhookDetailContextValue | null>(null);

type ProviderProps = {
  supabaseId: string;
  webhookId: string;
  children: ReactNode;
};

export function InboundWebhookDetailProvider({ supabaseId, webhookId, children }: ProviderProps) {
  const value = useInboundWebhookDetailHook(supabaseId, webhookId);
  return (
    <InboundWebhookDetailContext.Provider value={value}>{children}</InboundWebhookDetailContext.Provider>
  );
}

export function useInboundWebhookDetailContext(): InboundWebhookDetailContextValue {
  const context = useContext(InboundWebhookDetailContext);
  if (!context) {
    throw new Error("useInboundWebhookDetailContext must be used within InboundWebhookDetailProvider");
  }
  return context;
}
