"use client"

import { Loader2, Search, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { useBackofficeBeta } from "../context/BackofficeBetaContext"
import type { BetaClientItem } from "../context/BackofficeBetaTypes"

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

export function BackofficeBetaAddDialog() {
  const {
    addDialogOpen,
    addDialogFeature,
    clientQuery,
    clientPage,
    clientResults,
    isSearching,
    isAdding,
    closeAddDialog,
    setClientQuery,
    setClientPage,
    addBetaUser,
    features,
  } = useBackofficeBeta()

  const activeGrantProfileIds = new Set(
    (features.find((f) => f.id === addDialogFeature?.id)?.grants ?? [])
      .filter((g) => g.isActive)
      .map((g) => g.profileId)
  )

  function handleAdd(client: BetaClientItem) {
    addBetaUser(client)
  }

  return (
    <Dialog open={addDialogOpen} onOpenChange={(open) => { if (!open) closeAddDialog() }}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Adicionar ao grupo beta
            {addDialogFeature && (
              <span className="ml-1.5 font-normal text-muted-foreground">
                — {addDialogFeature.name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 overflow-y-auto flex-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={clientQuery}
              onChange={(e) => setClientQuery(e.target.value)}
              className="pl-8"
              disabled={isAdding}
            />
          </div>

          <div className="flex flex-col gap-1 min-h-50">
            {isSearching && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            )}

            {!isSearching && clientResults?.items.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado.
              </p>
            )}

            {!isSearching &&
              clientResults?.items.map((client) => {
                const alreadyInBeta = activeGrantProfileIds.has(client.id)
                return (
                  <div
                    key={client.id}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="size-8 shrink-0">
                        <AvatarImage src={client.profileIconUrl ?? undefined} alt={client.fullName} />
                        <AvatarFallback className="text-xs">{initials(client.fullName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{client.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{client.email}</p>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant={alreadyInBeta ? "secondary" : "default"}
                      disabled={alreadyInBeta || isAdding}
                      onClick={() => handleAdd(client)}
                      className="size-8 shrink-0"
                      aria-label={alreadyInBeta ? "Já no grupo beta" : `Adicionar ${client.fullName} ao grupo beta`}
                    >
                      {isAdding ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="size-3.5" />
                      )}
                    </Button>
                  </div>
                )
              })}
          </div>

          {clientResults && clientResults.pagination.totalPages > 1 && (
            <>
              <Separator />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Página {clientResults.pagination.page} de {clientResults.pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!clientResults.pagination.hasPreviousPage || isSearching}
                    onClick={() => setClientPage(clientPage - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!clientResults.pagination.hasNextPage || isSearching}
                    onClick={() => setClientPage(clientPage + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
