"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useOutboundWebhookCreate } from "./OutboundWebhookCreateHook";
import type { OutboundWebhookCreateState } from "./OutboundWebhookCreateTypes";

const OutboundWebhookCreateContext = createContext<OutboundWebhookCreateState | null>(null);

export function OutboundWebhookCreateProvider({
  supabaseId,
  children,
}: {
  supabaseId: string;
  children: ReactNode;
}) {
  const value = useOutboundWebhookCreate(supabaseId);
  return (
    <OutboundWebhookCreateContext.Provider value={value}>
      {children}
    </OutboundWebhookCreateContext.Provider>
  );
}

export function useOutboundWebhookCreateContext(): OutboundWebhookCreateState {
  const ctx = useContext(OutboundWebhookCreateContext);
  if (!ctx) {
    throw new Error("useOutboundWebhookCreateContext must be used within OutboundWebhookCreateProvider");
  }
  return ctx;
}
