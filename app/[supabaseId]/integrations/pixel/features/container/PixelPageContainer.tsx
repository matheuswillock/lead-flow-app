"use client";

import { RadarPixelIntegration } from "@/app/[supabaseId]/integrations/features/components/RadarPixelIntegration";
import { usePixelPage } from "../context/PixelPageHook";
import { PixelPageSkeleton } from "../components/PixelPageSkeleton";

/**
 * B-E3 — Página própria do Pixel. Embala `RadarPixelIntegration` (SPEC 30) sem
 * mover nem editar esse componente: ele continua lendo o estado do pixel do
 * `IntegrationsContext` compartilhado (mesma fonte de dados de sempre), então
 * esta página só reaproveita o provider existente em vez de duplicar o fetch.
 */
export function PixelPageContainer() {
  const { hasRadarAccess, isLoading } = usePixelPage();

  if (isLoading) {
    return <PixelPageSkeleton />;
  }

  if (!hasRadarAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Pixel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta área está disponível apenas para times com o Radar contratado.
          </p>
        </div>
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Fale com seu gerente de conta para contratar esta integração.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Pixel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rastreie visitantes anônimos do seu site e enriqueça perfis no Radar
        </p>
      </div>

      <RadarPixelIntegration />
    </div>
  );
}
