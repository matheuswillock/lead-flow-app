"use client";

import { BackofficeRadarEngagementProvider } from "./features/context/BackofficeRadarEngagementContext";
import { BackofficeRadarEngagementContainer } from "./features/container/BackofficeRadarEngagementContainer";
import { backofficeRadarEngagementService } from "./features/services/BackofficeRadarEngagementService";

export default function BackofficeRadarEngajamentoPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Engajamento do Radar</h1>
        <p className="text-sm text-muted-foreground">
          Configure pesos globais por evento e parâmetros de decaimento/bandas usados no score de
          engajamento.
        </p>
      </div>

      <BackofficeRadarEngagementProvider service={backofficeRadarEngagementService}>
        <BackofficeRadarEngagementContainer />
      </BackofficeRadarEngagementProvider>
    </div>
  );
}
