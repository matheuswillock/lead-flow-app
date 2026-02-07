"use client";

import { IntegrationProvider } from "./features/context/IntegrationContext";
import { IntegrationsContainer } from "./features/container/IntegrationsContainer";

export default function IntegrationsPage() {
  return (
    <IntegrationProvider>
      <div className="min-h-[100dvh] bg-background text-foreground">
        <div className="w-full px-6 py-6 space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Integrações</h1>
            <p className="text-sm text-muted-foreground">
              Conecte o Meta Lead Ads e o WhatsApp Cloud API por time/cliente.
            </p>
          </div>
          <IntegrationsContainer />
        </div>
      </div>
    </IntegrationProvider>
  );
}
