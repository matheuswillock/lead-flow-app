"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useInboundWebhooksList } from "./InboundWebhooksListHook";
import type { InboundWebhooksListState } from "./InboundWebhooksListTypes";

const InboundWebhooksListContext = createContext<InboundWebhooksListState | null>(null);

export function InboundWebhooksListProvider({
  supabaseId,
  children,
}: {
  supabaseId: string;
  children: ReactNode;
}) {
  const value = useInboundWebhooksList(supabaseId);
  return (
    <InboundWebhooksListContext.Provider value={value}>
      {children}
    </InboundWebhooksListContext.Provider>
  );
}

export function useInboundWebhooksListContext(): InboundWebhooksListState {
  const ctx = useContext(InboundWebhooksListContext);
  if (!ctx) {
    throw new Error("useInboundWebhooksListContext must be used within InboundWebhooksListProvider");
  }
  return ctx;
}
