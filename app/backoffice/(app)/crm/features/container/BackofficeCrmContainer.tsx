"use client"

import { Loader2 } from "lucide-react"
import { useBackofficeCrm } from "../context/BackofficeCrmHook"
import { BackofficeCrmKanban } from "../components/BackofficeCrmKanban"
import { BackofficeLeadFormDialog } from "../components/BackofficeLeadFormDialog"

export function BackofficeCrmContainer() {
  const { isLoading, error } = useBackofficeCrm()

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-3 p-4">
      {isLoading && (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Carregando leads...
        </div>
      )}

      {!isLoading && error && (
        <div className="flex flex-1 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!isLoading && !error && <BackofficeCrmKanban />}

      <BackofficeLeadFormDialog />
    </div>
  )
}
