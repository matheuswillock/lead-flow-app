"use client"

import { KeyRound, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import type { ProviderInstanceView } from "../context/BackofficePaymentProvidersTypes"
import { useBackofficePaymentProviders } from "../context/BackofficePaymentProvidersContext"
import { ProviderStatusBadges } from "./ProviderStatusBadges"

export function ProviderInstanceList() {
  const { instances, adapters, isLoading, canManage, selectInstance } = useBackofficePaymentProviders()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-label="Carregando providers">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (instances.length === 0) {
    return (
      <Empty className="border-2 border-muted-foreground/30">
        <EmptyHeader>
          <EmptyTitle>Nenhuma instância neste ambiente</EmptyTitle>
          <EmptyDescription>
            {canManage
              ? "Use “Nova instância” para escolher um adapter disponível e cadastrar as credenciais."
              : "Ainda não há instâncias configuradas neste ambiente."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ul className="flex flex-col divide-y rounded-md border">
      {instances.map((instance) => (
        <InstanceRow
          key={instance.id}
          instance={instance}
          adapterLabel={adapters.find((a) => a.providerKey === instance.providerKey)?.label ?? instance.providerKey}
          canManage={canManage}
          onOpen={() => selectInstance(instance.id)}
        />
      ))}
    </ul>
  )
}

function InstanceRow({
  instance,
  adapterLabel,
  canManage,
  onOpen,
}: {
  instance: ProviderInstanceView
  adapterLabel: string
  canManage: boolean
  onOpen: () => void
}) {
  const setCount = instance.credentials.filter((c) => c.isSet).length

  return (
    <li className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="text-base font-semibold break-words">{instance.displayName}</h2>
          <span className="text-sm text-muted-foreground">
            {adapterLabel} · contexto {instance.externalAccountContext}
          </span>
        </div>
        <ProviderStatusBadges instance={instance} />
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <KeyRound className="size-3.5" aria-hidden="true" />
            {setCount} de {instance.credentials.length} credenciais definidas
          </span>
          {instance.lastErrorCode && <span>Último erro: {instance.lastErrorCode}</span>}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onOpen}
        className="max-lg:h-11"
        aria-label={`${canManage ? "Gerenciar" : "Ver"} ${instance.displayName}`}
      >
        <Settings2 data-icon="inline-start" />
        {canManage ? "Gerenciar" : "Ver detalhes"}
      </Button>
    </li>
  )
}
