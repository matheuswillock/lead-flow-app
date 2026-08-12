"use client";

import { BackofficeRadarOutboxThroughputProvider } from "./features/context/BackofficeRadarOutboxThroughputContext";
import { BackofficeRadarOutboxThroughputContainer } from "./features/container/BackofficeRadarOutboxThroughputContainer";
import { backofficeRadarOutboxThroughputService } from "./features/services/BackofficeRadarOutboxThroughputService";

export default function BackofficeRadarOutboxPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Outbox Radar — vazão</h1>
        <p className="text-sm text-muted-foreground">
          Controle batch e concorrência do cron que drena a fila de sync de contatos para o Radar
          (D9), dentro dos limites mínimos e máximos do código.
        </p>
      </div>

      <BackofficeRadarOutboxThroughputProvider service={backofficeRadarOutboxThroughputService}>
        <BackofficeRadarOutboxThroughputContainer />
      </BackofficeRadarOutboxThroughputProvider>
    </div>
  );
}
