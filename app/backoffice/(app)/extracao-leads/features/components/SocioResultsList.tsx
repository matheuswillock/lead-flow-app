"use client"

import { Search } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { SocioCard } from "./SocioCard"
import { useBackofficeLeadExtraction } from "../context/BackofficeLeadExtractionHook"

export function SocioResultsList() {
  const { socioResults, socioTotalCount, isSocioSearching, hasSearchedSocios } =
    useBackofficeLeadExtraction()

  if (isSocioSearching) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <SocioResultsHeader totalCount={null} />
        <div className="flex flex-1 flex-col gap-0 overflow-y-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-b px-5 py-4">
              <div className="mb-2 flex items-start gap-2">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!hasSearchedSocios) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border bg-card shadow-sm p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Search className="size-6 text-primary" />
        </div>
        <p className="text-base font-semibold">Nenhuma busca realizada</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Informe o nome do sócio no painel e clique em Pesquisar para encontrar vínculos empresariais.
        </p>
      </div>
    )
  }

  if (socioResults.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border bg-card shadow-sm p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <Search className="size-6 text-muted-foreground" />
        </div>
        <p className="text-base font-semibold">Nenhum sócio encontrado</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Tente ajustar o nome ou os filtros para ampliar a busca.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <SocioResultsHeader totalCount={socioTotalCount} />
      <div className="flex-1 overflow-y-auto">
        {socioResults.map((socio) => (
          <SocioCard key={socio.id} socio={socio} />
        ))}
      </div>
      <div className="shrink-0 border-t px-5 py-3">
        <p className="text-xs text-muted-foreground">
          Exibindo {socioResults.length.toLocaleString("pt-BR")} de {socioTotalCount.toLocaleString("pt-BR")} sócios encontrados
        </p>
      </div>
    </div>
  )
}

function SocioResultsHeader({ totalCount }: { totalCount: number | null }) {
  return (
    <div className="flex shrink-0 items-center border-b px-5 py-4">
      <div>
        <p className="text-xl font-bold">
          {totalCount !== null
            ? `${totalCount.toLocaleString("pt-BR")} sócios`
            : "Pesquisando…"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {totalCount !== null ? "Baseado nos filtros preenchidos" : "Aguarde"}
        </p>
      </div>
    </div>
  )
}
