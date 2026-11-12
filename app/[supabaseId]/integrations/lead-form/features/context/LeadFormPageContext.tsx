"use client";

import { IntegrationsProvider } from "@/app/[supabaseId]/integrations/features/context/IntegrationsContext";

interface LeadFormPageProviderProps {
  supabaseId: string;
  children: React.ReactNode;
}

/**
 * Provider da página do Formulário de Captação. Delega para o
 * `IntegrationsProvider` compartilhado em vez de duplicar o fetch do bootstrap
 * de integrações (mesmo padrão de `PixelPageProvider`).
 */
export function LeadFormPageProvider({ supabaseId, children }: LeadFormPageProviderProps) {
  return <IntegrationsProvider supabaseId={supabaseId}>{children}</IntegrationsProvider>;
}
