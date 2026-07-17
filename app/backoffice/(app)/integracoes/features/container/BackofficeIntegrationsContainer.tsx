"use client"

import { Loader2 } from "lucide-react"
import { useBackofficeIntegrations } from "../context/BackofficeIntegrationsHook"
import { BackofficeMetaIntegrationCard } from "../components/BackofficeMetaIntegrationCard"
import { BackofficeLeadQuickEntryIntegrationCard } from "../components/BackofficeLeadQuickEntryIntegrationCard"

export function BackofficeIntegrationsContainer() {
  const { isLoading, error, metaConfig } = useBackofficeIntegrations()
  const showLoader = isLoading && !metaConfig

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="text-sm text-muted-foreground">
          Configure integrações exclusivas do Corretor Studio com plataformas externas.
        </p>
      </div>

      {showLoader && (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Carregando integrações...
        </div>
      )}

      {!showLoader && error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!showLoader && !error && (
        <div className="flex flex-col gap-4">
          <BackofficeMetaIntegrationCard />
          <BackofficeLeadQuickEntryIntegrationCard />
        </div>
      )}
    </div>
  )
}
