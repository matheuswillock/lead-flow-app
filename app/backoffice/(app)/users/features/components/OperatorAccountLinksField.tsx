"use client"

import { useEffect, useState } from "react"
import { Building2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import type { OperatorLinkDraft } from "../context/useOperatorAccountLinks"
import type {
  IBackofficeOperatorLinksService,
  OperatorAccountSummary,
} from "../services/IBackofficeOperatorLinksService"

const SEARCH_DEBOUNCE_MS = 300

interface OperatorAccountLinksFieldProps {
  service: IBackofficeOperatorLinksService
  drafts: OperatorLinkDraft[]
  isLoading: boolean
  loadError: string | null
  disabled?: boolean
  onAddAccount: (account: OperatorAccountSummary) => void
  onRemoveAccount: (masterId: string) => void
  onToggleTeam: (masterId: string, teamId: string, checked: boolean) => void
}

function useAccountSearch(service: IBackofficeOperatorLinksService, open: boolean, query: string) {
  const [results, setResults] = useState<OperatorAccountSummary[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setIsSearching(true)
    setHasError(false)

    const timer = setTimeout(async () => {
      try {
        const found = await service.searchAccounts(query.trim())
        if (!cancelled) setResults(found)
      } catch (error) {
        console.error("[OperatorAccountLinksField][search]", error)
        if (!cancelled) {
          setResults([])
          setHasError(true)
        }
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [service, open, query])

  return { results, isSearching, hasError }
}

export function OperatorAccountLinksField({
  service,
  drafts,
  isLoading,
  loadError,
  disabled = false,
  onAddAccount,
  onRemoveAccount,
  onToggleTeam,
}: OperatorAccountLinksFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState("")
  const { results, isSearching, hasError } = useAccountSearch(service, pickerOpen, query)
  const linkedIds = new Set(drafts.map((draft) => draft.masterId))

  function handlePick(account: OperatorAccountSummary) {
    onAddAccount(account)
    setPickerOpen(false)
    setQuery("")
  }

  return (
    <div data-testid="operator-account-links" className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-col gap-1">
        <Label>Contas e times</Label>
        <p className="text-xs text-muted-foreground">
          Escolha onde este Operator trabalha. O corretor vê o usuário no time, com o selo SDR
          Backoffice ou Closer Backoffice, e não consegue alterá-lo.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : loadError ? (
        <p className="text-xs text-destructive" role="alert">
          {loadError}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta vinculada ainda.</p>
          ) : (
            drafts.map((draft) => (
              <div key={draft.masterId} className="flex flex-col gap-2 rounded-md bg-muted/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {draft.masterName ?? draft.masterEmail}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {draft.masterEmail}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0 max-lg:size-11"
                    onClick={() => onRemoveAccount(draft.masterId)}
                    disabled={disabled}
                    aria-label={`Remover conta ${draft.masterName ?? draft.masterEmail}`}
                  >
                    <X />
                  </Button>
                </div>

                {draft.teams === null ? (
                  <Skeleton className="h-8 w-full" />
                ) : draft.teamsError ? (
                  <p className="text-xs text-destructive" role="alert">
                    Não foi possível carregar os times desta conta.
                  </p>
                ) : draft.teams.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Esta conta ainda não tem times.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {draft.teams.map((team) => {
                      const checkboxId = `link-${draft.masterId}-${team.id}`
                      return (
                        <li key={team.id}>
                          <Label
                            htmlFor={checkboxId}
                            className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 font-normal hover:bg-muted max-lg:min-h-11"
                          >
                            <Checkbox
                              id={checkboxId}
                              checked={draft.selectedTeamIds.includes(team.id)}
                              onCheckedChange={(checked) =>
                                onToggleTeam(draft.masterId, team.id, checked === true)
                              }
                              disabled={disabled}
                            />
                            <span className="min-w-0 break-words">{team.name}</span>
                          </Label>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {draft.teams && draft.teams.length > 0 && draft.selectedTeamIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Marque ao menos um time, senão a conta não será vinculada.
                  </p>
                ) : null}
              </div>
            ))
          )}

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="self-start max-lg:h-11"
                disabled={disabled}
              >
                <Plus data-icon="inline-start" />
                Adicionar conta
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(22rem,calc(100vw-3rem))] p-0">
              <Command shouldFilter={false}>
                <CommandInput
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Buscar conta por nome ou e-mail"
                />
                <CommandList>
                  {isSearching ? (
                    <div className="p-2" aria-busy="true">
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : hasError ? (
                    <p className="p-3 text-xs text-destructive" role="alert">
                      Não foi possível buscar as contas.
                    </p>
                  ) : (
                    <>
                      <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                      <CommandGroup>
                        {results.map((account) => (
                          <CommandItem
                            key={account.id}
                            value={account.id}
                            disabled={linkedIds.has(account.id)}
                            onSelect={() => handlePick(account)}
                          >
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-sm">
                                {account.fullName ?? account.email}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {account.email}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  )
}
