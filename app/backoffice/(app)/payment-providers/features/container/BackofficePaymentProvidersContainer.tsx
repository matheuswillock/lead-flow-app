"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateProviderInstanceDialog } from "../components/CreateProviderInstanceDialog"
import { ProviderInstanceList } from "../components/ProviderInstanceList"
import { ProviderInstanceSheet } from "../components/ProviderInstanceSheet"
import { useBackofficePaymentProviders } from "../context/BackofficePaymentProvidersContext"
import {
  ENVIRONMENT_LABELS,
  PAYMENT_PROVIDER_ENVIRONMENTS,
  type PaymentProviderEnvironment,
} from "../context/BackofficePaymentProvidersTypes"

export function BackofficePaymentProvidersContainer() {
  const { environment, setEnvironment, canManage, currentDefault, isLoading } = useBackofficePaymentProviders()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Providers de pagamento</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Instâncias, credenciais e padrão de cada ambiente. Os valores das credenciais nunca são exibidos.
          </p>
        </div>
        {canManage && (
          <Button type="button" onClick={() => setCreateOpen(true)} className="max-lg:h-11">
            <Plus data-icon="inline-start" />
            Nova instância
          </Button>
        )}
      </div>

      <Tabs value={environment} onValueChange={(v) => setEnvironment(v as PaymentProviderEnvironment)}>
        <TabsList>
          {PAYMENT_PROVIDER_ENVIRONMENTS.map((env) => (
            <TabsTrigger key={env} value={env} className="max-lg:min-h-11">
              {ENVIRONMENT_LABELS[env]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          Padrão atual: {currentDefault ? <strong className="text-foreground">{currentDefault.displayName}</strong> : "nenhum definido"}
        </p>
      )}

      <ProviderInstanceList onCreate={() => setCreateOpen(true)} />
      <ProviderInstanceSheet />
      <CreateProviderInstanceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
