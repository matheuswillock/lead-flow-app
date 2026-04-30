"use client"

import { Plus, Table2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useBackofficeCrm } from "../context/BackofficeCrmHook"
import { BackofficeCrmColumnSettingsButton, BackofficeCrmTable } from "../components/BackofficeCrmTable"
import { BackofficeCrmFiltersBar } from "../components/BackofficeCrmFiltersBar"
import { BackofficeLeadFormDialog } from "../components/BackofficeLeadFormDialog"

export function BackofficeCrmContainer() {
  const { isLoading, error, leads, filteredLeads, openCreateDialog } = useBackofficeCrm()
  const leadCountLabel = isLoading
    ? "Carregando..."
    : filteredLeads.length === leads.length
      ? `${leads.length} leads`
      : `${filteredLeads.length} de ${leads.length} leads`

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Table2 className="size-6" />
          <div>
            <h1 className="text-2xl font-semibold">CRM</h1>
            <p className="text-sm text-muted-foreground">
              Pipeline operacional do backoffice em tabela. {leadCountLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreateDialog}>
            <Plus data-icon="inline-start" />
            Adicionar novo lead
          </Button>
          <BackofficeCrmColumnSettingsButton />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-[250px]" />
            <Skeleton className="h-8 w-[110px]" />
            <Skeleton className="h-8 w-[160px]" />
          </div>
          <div className="rounded-md border p-2">
            <Skeleton className="h-10 w-full" />
            <div className="mt-2 flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar leads</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <BackofficeCrmFiltersBar />
          <BackofficeCrmTable />
        </>
      )}

      <BackofficeLeadFormDialog />
    </div>
  )
}
