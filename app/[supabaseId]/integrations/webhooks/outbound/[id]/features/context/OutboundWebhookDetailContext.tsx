"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useOutboundWebhookDetail } from "./OutboundWebhookDetailHook";
import type { OutboundWebhookDetailState } from "./OutboundWebhookDetailTypes";

const OutboundWebhookDetailContext = createContext<OutboundWebhookDetailState | null>(null);

export function OutboundWebhookDetailProvider({
  supabaseId,
  webhookId,
  children,
}: {
  supabaseId: string;
  webhookId: string;
  children: ReactNode;
}) {
  const value = useOutboundWebhookDetail(supabaseId, webhookId);
  return (
    <OutboundWebhookDetailContext.Provider value={value}>
      {children}
    </OutboundWebhookDetailContext.Provider>
  );
}

export function useOutboundWebhookDetailContext(): OutboundWebhookDetailState {
  const ctx = useContext(OutboundWebhookDetailContext);
  if (!ctx) {
    throw new Error("useOutboundWebhookDetailContext must be used within OutboundWebhookDetailProvider");
  }
  return ctx;
}
