"use client"

import { ArrowLeft, Loader2, Search, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
    addDialogStep,
    editingGrant,
    selectedMaster,
    masterTeams,
    teamScope,
    selectedTeamIds,
    isLoadingTeams,
    clientQuery,
    clientPage,
    clientResults,
    isSearching,
    isAdding,
    closeAddDialog,
    selectMaster,
    backToMasterSearch,
    setClientQuery,
    setClientPage,
    setTeamScope,
    toggleTeamSelection,
    confirmBetaGrant,
    features,
  } = useBackofficeBeta()

  const activeGrantProfileIds = new Set(
    (features.find((f) => f.id === addDialogFeature?.id)?.grants ?? [])
      .filter((g) => g.isActive)
      .map((g) => g.profileId)
  )

  function handleSelectMaster(client: BetaClientItem) {
    if (activeGrantProfileIds.has(client.id) && !editingGrant) return
    selectMaster(client)
  }

  const dialogTitle = editingGrant
    ? `Editar escopo beta — ${addDialogFeature?.name ?? ""}`
    : addDialogStep === "search"
      ? `Adicionar ao grupo beta — ${addDialogFeature?.name ?? ""}`
      : `Escopo de times — ${selectedMaster?.fullName ?? ""}`

  return (
    <Dialog open={addDialogOpen} onOpenChange={(open) => { if (!open) closeAddDialog() }}>
      <DialogContent className="flex max-h-[90vh] min-h-0 flex-col overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {addDialogStep === "search" && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="relative shrink-0">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar master por nome ou e-mail..."
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                className="pl-8"
                disabled={isAdding}
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {isSearching && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              )}

              {!isSearching && clientResults?.items.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum master encontrado.
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
                        onClick={() => handleSelectMaster(client)}
                        className="size-8 shrink-0"
                        aria-label={
                          alreadyInBeta
                            ? "Master já no grupo beta"
                            : `Selecionar ${client.fullName}`
                        }
                      >
                        <UserPlus className="size-3.5" />
                      </Button>
                    </div>
                  )
                })}
            </div>

            {clientResults && clientResults.pagination.totalPages > 1 && (
              <div className="flex shrink-0 flex-col gap-3">
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
              </div>
            )}
          </div>
        )}

        {addDialogStep === "teams" && selectedMaster && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            {!editingGrant && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit shrink-0 px-0"
                onClick={backToMasterSearch}
                disabled={isAdding}
              >
                <ArrowLeft data-icon="inline-start" />
                Voltar para busca
              </Button>
            )}

            <div className="flex shrink-0 items-center gap-2 rounded-md border bg-muted/30 p-3">
              <Avatar className="size-8 shrink-0">
                <AvatarImage
                  src={selectedMaster.profileIconUrl ?? undefined}
                  alt={selectedMaster.fullName}
                />
                <AvatarFallback className="text-xs">{initials(selectedMaster.fullName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{selectedMaster.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">{selectedMaster.email}</p>
              </div>
            </div>

            {isLoadingTeams ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : (
              <FieldGroup>
                <Field>
                  <FieldLabel>Escopo de times</FieldLabel>
                  <RadioGroup
                    value={teamScope}
                    onValueChange={(value) =>
                      setTeamScope(value as "ALL_TEAMS" | "SPECIFIC_TEAMS")
                    }
                    className="flex flex-col gap-2"
                    disabled={isAdding}
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="ALL_TEAMS" />
                      Todos os times
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="SPECIFIC_TEAMS" />
                      Times específicos
                    </label>
                  </RadioGroup>
                </Field>

                {teamScope === "SPECIFIC_TEAMS" && (
                  <Field>
                    <FieldLabel>Selecione os times</FieldLabel>
                    {masterTeams.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Este master não possui times cadastrados.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {masterTeams.map((team) => (
                          <label
                            key={team.id}
                            className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                          >
                            <Checkbox
                              checked={selectedTeamIds.includes(team.id)}
                              onCheckedChange={() => toggleTeamSelection(team.id)}
                              disabled={isAdding}
                            />
                            {team.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </Field>
                )}
              </FieldGroup>
            )}
          </div>
        )}

        {addDialogStep === "teams" && (
          <DialogFooter>
            <Button variant="outline" onClick={closeAddDialog} disabled={isAdding}>
              Cancelar
            </Button>
            <Button onClick={confirmBetaGrant} disabled={isAdding || isLoadingTeams}>
              {isAdding ? <Loader2 className="size-4 animate-spin" /> : editingGrant ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
