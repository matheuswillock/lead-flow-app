"use client"

import { useEffect } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useBackofficePaymentProviders } from "../context/BackofficePaymentProvidersContext"

export function ProviderHistorySection({ configId }: { configId: string }) {
  const { history, isHistoryLoading, loadHistory } = useBackofficePaymentProviders()

  useEffect(() => {
    void loadHistory(configId)
  }, [configId, loadHistory])

  return (
    <section aria-labelledby="provider-history-title" className="flex flex-col gap-3">
      <h3 id="provider-history-title" className="text-sm font-semibold">
        Histórico de alterações
      </h3>
      {isHistoryLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : history.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma alteração registrada.</p>
      ) : (
        <ol className="flex flex-col divide-y rounded-md border text-sm">
          {history.map((item, index) => (
            <li key={`${item.at}-${index}`} className="flex flex-col gap-0.5 p-3">
              <span>{item.summary}</span>
              <span className="text-xs text-muted-foreground">
                {item.operation} · {item.actor} · {new Date(item.at).toLocaleString("pt-BR")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
