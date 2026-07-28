"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useInboundWebhookDetail } from "./InboundWebhookDetailHook";
import type { InboundWebhookDetailState } from "./InboundWebhookDetailTypes";

const InboundWebhookDetailContext = createContext<InboundWebhookDetailState | null>(null);

export function InboundWebhookDetailProvider({
  supabaseId,
  webhookId,
  children,
}: {
  supabaseId: string;
  webhookId: string;
  children: ReactNode;
}) {
  const value = useInboundWebhookDetail(supabaseId, webhookId);
  return (
    <InboundWebhookDetailContext.Provider value={value}>
      {children}
    </InboundWebhookDetailContext.Provider>
  );
}

export function useInboundWebhookDetailContext(): InboundWebhookDetailState {
  const ctx = useContext(InboundWebhookDetailContext);
  if (!ctx) {
    throw new Error("useInboundWebhookDetailContext must be used within InboundWebhookDetailProvider");
  }
  return ctx;
}
