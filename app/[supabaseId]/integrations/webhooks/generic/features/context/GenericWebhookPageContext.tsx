"use client";

import { IntegrationsProvider } from "@/app/[supabaseId]/integrations/features/context/IntegrationsContext";

interface GenericWebhookPageProviderProps {
  supabaseId: string;
  children: React.ReactNode;
}

/**
 * Provider da página do Webhook Genérico. Delega para o `IntegrationsProvider`
 * compartilhado em vez de duplicar o fetch (mesmo padrão de `PixelPageProvider`).
 */
export function GenericWebhookPageProvider({ supabaseId, children }: GenericWebhookPageProviderProps) {
  return <IntegrationsProvider supabaseId={supabaseId}>{children}</IntegrationsProvider>;
}
