"use client"

import { Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CompanyCard } from "./CompanyCard"
import { useBackofficeLeadExtraction } from "../context/BackofficeLeadExtractionHook"

export function ResultsList() {
  const { results, totalCount, isSearching, hasSearched } = useBackofficeLeadExtraction()

  if (isSearching) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <ResultsHeader totalCount={null} />
        <div className="flex flex-1 flex-col gap-0 overflow-y-auto">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b px-5 py-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!hasSearched) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border bg-card shadow-sm p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Search className="size-6 text-primary" />
        </div>
        <p className="text-base font-semibold">Nenhuma busca realizada</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Configure os filtros no painel e clique em Pesquisar para encontrar empresas pelo CNAE, UF e outros critérios.
        </p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border bg-card shadow-sm p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <Search className="size-6 text-muted-foreground" />
        </div>
        <p className="text-base font-semibold">Nenhuma empresa encontrada</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Tente ajustar os filtros para ampliar a busca.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <ResultsHeader totalCount={totalCount} />
      <div className="flex-1 overflow-y-auto">
        {results.map((company) => (
          <CompanyCard key={company.taxId} company={company} />
        ))}
      </div>
      <div className="shrink-0 border-t px-5 py-3">
        <p className="text-xs text-muted-foreground">
          Exibindo {results.length.toLocaleString("pt-BR")} de {totalCount.toLocaleString("pt-BR")} empresas encontradas
        </p>
      </div>
    </div>
  )
}

function ResultsHeader({ totalCount }: { totalCount: number | null }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
      <div>
        <p className="text-xl font-bold">
          {totalCount !== null
            ? `${totalCount.toLocaleString("pt-BR")} empresas`
            : "Pesquisando…"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {totalCount !== null ? "Baseado nos filtros preenchidos" : "Aguarde"}
        </p>
      </div>
      {totalCount !== null && totalCount > 0 && (
        <Button variant="default" size="sm" className="gap-2">
          <Download data-icon="inline-start" />
          Exportar lista
        </Button>
      )}
    </div>
  )
}
