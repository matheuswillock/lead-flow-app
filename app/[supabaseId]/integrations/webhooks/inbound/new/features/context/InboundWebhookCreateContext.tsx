"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useInboundWebhookCreate } from "./InboundWebhookCreateHook";
import type { InboundWebhookCreateState } from "./InboundWebhookCreateTypes";

const InboundWebhookCreateContext = createContext<InboundWebhookCreateState | null>(null);

export function InboundWebhookCreateProvider({
  supabaseId,
  children,
}: {
  supabaseId: string;
  children: ReactNode;
}) {
  const value = useInboundWebhookCreate(supabaseId);
  return (
    <InboundWebhookCreateContext.Provider value={value}>
      {children}
    </InboundWebhookCreateContext.Provider>
  );
}

export function useInboundWebhookCreateContext(): InboundWebhookCreateState {
  const ctx = useContext(InboundWebhookCreateContext);
  if (!ctx) {
    throw new Error("useInboundWebhookCreateContext must be used within InboundWebhookCreateProvider");
  }
  return ctx;
}
