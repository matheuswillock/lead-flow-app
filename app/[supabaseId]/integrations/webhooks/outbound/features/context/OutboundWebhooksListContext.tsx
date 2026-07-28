"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useOutboundWebhooksList } from "./OutboundWebhooksListHook";
import type { OutboundWebhooksListState } from "./OutboundWebhooksListTypes";

const OutboundWebhooksListContext = createContext<OutboundWebhooksListState | null>(null);

export function OutboundWebhooksListProvider({
  supabaseId,
  children,
}: {
  supabaseId: string;
  children: ReactNode;
}) {
  const value = useOutboundWebhooksList(supabaseId);
  return (
    <OutboundWebhooksListContext.Provider value={value}>
      {children}
    </OutboundWebhooksListContext.Provider>
  );
}

export function useOutboundWebhooksListContext(): OutboundWebhooksListState {
  const ctx = useContext(OutboundWebhooksListContext);
  if (!ctx) {
    throw new Error("useOutboundWebhooksListContext must be used within OutboundWebhooksListProvider");
  }
  return ctx;
}
