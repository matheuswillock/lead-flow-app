"use client";

import { LeadFormIntegration } from "../components/LeadFormIntegration";

export function IntegrationsContainer() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte o Corretor Studio a ferramentas e sites externos
        </p>
      </div>

      <LeadFormIntegration />
    </div>
  );
}
