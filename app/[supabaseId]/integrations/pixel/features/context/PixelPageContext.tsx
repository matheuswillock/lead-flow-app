"use client";

import { IntegrationsProvider } from "@/app/[supabaseId]/integrations/features/context/IntegrationsContext";

interface PixelPageProviderProps {
  supabaseId: string;
  children: React.ReactNode;
}

/**
 * Provider da página do Pixel. Delega para o `IntegrationsProvider`
 * compartilhado em vez de duplicar o fetch de configuração do pixel — o
 * `RadarPixelIntegration` (SPEC 30) não foi movido nem editado e continua
 * lendo exatamente essa mesma fonte.
 */
export function PixelPageProvider({ supabaseId, children }: PixelPageProviderProps) {
  return <IntegrationsProvider supabaseId={supabaseId}>{children}</IntegrationsProvider>;
}
