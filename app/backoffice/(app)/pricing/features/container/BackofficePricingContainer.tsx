"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BackofficeProductDeleteDialog } from "../components/BackofficeProductDeleteDialog"
import { BackofficeProductDialog } from "../components/BackofficeProductDialog"
import { BackofficeProductTable } from "../components/BackofficeProductTable"
import { useBackofficePricing } from "../context/BackofficePricingContext"

export function BackofficePricingContainer() {
  const { products, isLoading, openCreateDialog } = useBackofficePricing()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Precificação</h1>
          <p className="text-sm text-muted-foreground">
            Produtos e preços usados nos fluxos de adesão do backoffice.
          </p>
        </div>
        <Button type="button" onClick={openCreateDialog}>
          <Plus data-icon="inline-start" />
          Novo Produto
        </Button>
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
        <BackofficeProductTable products={products} />
      )}

      <BackofficeProductDialog />
      <BackofficeProductDeleteDialog />
    </div>
  )
}
