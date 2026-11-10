"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  IBackofficeOperatorLinksService,
  OperatorAccountSummary,
  OperatorAccountTeam,
  OperatorLinkPayload,
} from "../services/IBackofficeOperatorLinksService"

export interface OperatorLinkDraft {
  masterId: string
  masterName: string | null
  masterEmail: string
  /** null enquanto os times da conta carregam. */
  teams: OperatorAccountTeam[] | null
  selectedTeamIds: string[]
  teamsError: boolean
}

function toPayload(drafts: OperatorLinkDraft[]): OperatorLinkPayload[] {
  return drafts
    .filter((draft) => draft.selectedTeamIds.length > 0)
    .map((draft) => ({ masterId: draft.masterId, teamIds: draft.selectedTeamIds }))
}

/**
 * Rascunho das contas e times de um Operator. Com `userId` carrega o que já
 * está salvo; sem `userId` (criação) começa vazio e salva depois do cadastro.
 */
export function useOperatorAccountLinks(
  service: IBackofficeOperatorLinksService,
  userId: string | null,
  enabled: boolean
) {
  const [drafts, setDrafts] = useState<OperatorLinkDraft[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const savingRef = useRef(false)

  const loadTeams = useCallback(
    async (masterId: string) => {
      try {
        const teams = await service.listAccountTeams(masterId)
        setDrafts((current) =>
          current.map((draft) =>
            draft.masterId === masterId ? { ...draft, teams, teamsError: false } : draft
          )
        )
      } catch (error) {
        console.error("[useOperatorAccountLinks][loadTeams]", error)
        setDrafts((current) =>
          current.map((draft) =>
            draft.masterId === masterId ? { ...draft, teams: [], teamsError: true } : draft
          )
        )
      }
    },
    [service]
  )

  useEffect(() => {
    if (!enabled) {
      setDrafts([])
      setLoadError(null)
      return
    }
    if (!userId) {
      setDrafts([])
      return
    }

    let cancelled = false
    setIsLoading(true)
    setLoadError(null)

    async function load(id: string) {
      try {
        const accounts = await service.getLinks(id)
        const withTeams = await Promise.all(
          accounts.map(async (account): Promise<OperatorLinkDraft> => {
            const selectedTeamIds = account.teams.map((team) => team.id)
            try {
              const teams = await service.listAccountTeams(account.masterId)
              return {
                masterId: account.masterId,
                masterName: account.masterName,
                masterEmail: account.masterEmail,
                teams,
                selectedTeamIds,
                teamsError: false,
              }
            } catch {
              return {
                masterId: account.masterId,
                masterName: account.masterName,
                masterEmail: account.masterEmail,
                teams: account.teams,
                selectedTeamIds,
                teamsError: true,
              }
            }
          })
        )
        if (!cancelled) setDrafts(withTeams)
      } catch (error) {
        console.error("[useOperatorAccountLinks][load]", error)
        if (!cancelled) setLoadError("Não foi possível carregar as contas e times")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load(userId)
    return () => {
      cancelled = true
    }
  }, [service, userId, enabled])

  const addAccount = useCallback(
    (account: OperatorAccountSummary) => {
      let shouldLoad = false
      setDrafts((current) => {
        if (current.some((draft) => draft.masterId === account.id)) return current
        shouldLoad = true
        return [
          ...current,
          {
            masterId: account.id,
            masterName: account.fullName,
            masterEmail: account.email,
            teams: null,
            selectedTeamIds: [],
            teamsError: false,
          },
        ]
      })
      if (shouldLoad) void loadTeams(account.id)
    },
    [loadTeams]
  )

  const removeAccount = useCallback((masterId: string) => {
    setDrafts((current) => current.filter((draft) => draft.masterId !== masterId))
  }, [])

  const toggleTeam = useCallback((masterId: string, teamId: string, checked: boolean) => {
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.masterId !== masterId) return draft
        const withoutTeam = draft.selectedTeamIds.filter((id) => id !== teamId)
        return { ...draft, selectedTeamIds: checked ? [...withoutTeam, teamId] : withoutTeam }
      })
    )
  }, [])

  const save = useCallback(
    async (targetUserId: string) => {
      if (savingRef.current) return { isValid: false, errorMessages: ["Salvamento em andamento"] }
      savingRef.current = true
      setIsSaving(true)
      try {
        return await service.saveLinks(targetUserId, toPayload(drafts))
      } finally {
        savingRef.current = false
        setIsSaving(false)
      }
    },
    [service, drafts]
  )

  return {
    drafts,
    isLoading,
    loadError,
    isSaving,
    addAccount,
    removeAccount,
    toggleTeam,
    save,
    hasPayload: toPayload(drafts).length > 0,
  }
}
