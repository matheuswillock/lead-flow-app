"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { BackofficeBetaFeatureCard } from "../components/BackofficeBetaFeatureCard"
import { BackofficeBetaAddDialog } from "../components/BackofficeBetaAddDialog"
import { useBackofficeBeta } from "../context/BackofficeBetaContext"

export function BackofficeBetaContainer() {
  const { features, isLoading } = useBackofficeBeta()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">Grupo Beta</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie quais clientes têm acesso antecipado às funcionalidades beta.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : features.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma funcionalidade com beta ativado. Ative o beta em uma funcionalidade para gerenciar o grupo aqui.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <BackofficeBetaFeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
      )}

      <BackofficeBetaAddDialog />
    </div>
  )
}
