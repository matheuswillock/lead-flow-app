"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BackofficeFeatureTable } from "../components/BackofficeFeatureTable"
import { BackofficeFeatureDialog } from "../components/BackofficeFeatureDialog"
import { BackofficeFeatureDeleteDialog } from "../components/BackofficeFeatureDeleteDialog"
import { useBackofficeFeature } from "../context/BackofficeFeatureContext"

export function BackofficeFeatureContainer() {
  const { features, isLoading, canManage, openCreateDialog } = useBackofficeFeature()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Funcionalidades</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as funcionalidades e controle de acesso do produto.
          </p>
        </div>
        {canManage && (
          <Button type="button" onClick={openCreateDialog}>
            <Plus data-icon="inline-start" />
            Nova Funcionalidade
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-md border">
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <BackofficeFeatureTable features={features} />
      )}

      <BackofficeFeatureDialog />
      <BackofficeFeatureDeleteDialog />
    </div>
  )
}
