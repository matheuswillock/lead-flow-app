"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { IBackofficeTeamEmailLimitService } from "../services/IBackofficeTeamEmailLimitService"
import type {
  IBackofficeTeamEmailLimitContext,
  SendingHealthAction,
  TeamSendingHealthItem,
} from "./BackofficeTeamEmailLimitTypes"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"

export function useBackofficeTeamEmailLimitHook(
  service: IBackofficeTeamEmailLimitService
): IBackofficeTeamEmailLimitContext {
  const [grants, setGrants] = useState<IBackofficeTeamEmailLimitContext["grants"]>([])
  const [sendingHealthByTeamId, setSendingHealthByTeamId] = useState<
    Record<string, TeamSendingHealthItem>
  >({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGranting, setIsGranting] = useState(false)
  const [isRevokingId, setIsRevokingId] = useState<string | null>(null)
  const [isApplyingHealthTeamId, setIsApplyingHealthTeamId] = useState<string | null>(null)
  const inFlightRef = useRef(false)

  /**
   * Busca SEM `teamIds`: a rota devolve todos os times fora de `healthy`.
   *
   * Pedir saúde só para `result.grants` escondia exatamente o caso que a tela
   * existe para resolver: time `suspended` sem limite customizado — e
   * suspensão só sai pelo backoffice. Grant que não aparecer na resposta está
   * `healthy` por definição, então uma chamada cobre as duas necessidades.
   */
  const fetchSendingHealth = useCallback(async () => {
    try {
      const result = await service.listSendingHealth()
      const byTeamId: Record<string, TeamSendingHealthItem> = {}
      for (const team of result.teams) byTeamId[team.teamId] = team
      setSendingHealthByTeamId(byTeamId)
    } catch (healthError) {
      // Coluna informativa: falha aqui não pode derrubar a tela de limites.
      console.error("[useBackofficeTeamEmailLimitHook] fetchSendingHealth", healthError)
    }
  }, [service])

  const fetchItems = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setIsLoading(true)
    setError(null)
    try {
      const result = await service.list()
      setGrants(result.grants)
      await fetchSendingHealth()
    } catch (fetchError) {
      setError(toUserToastMessage(fetchError))
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }, [fetchSendingHealth, service])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  const searchTeams = useCallback(
    async (query: string) => {
      const result = await service.searchTeams(query)
      return result.teams
    },
    [service]
  )

  const grant = useCallback(
    async (teamId: string, maxEmailsPerDay: number | null, notes?: string | null) => {
      if (isGranting) return false
      setIsGranting(true)
      try {
        await service.grant(teamId, maxEmailsPerDay, notes)
        await fetchItems()
        return true
      } catch (grantError) {
        setError(toUserToastMessage(grantError))
        return false
      } finally {
        setIsGranting(false)
      }
    },
    [fetchItems, isGranting, service]
  )

  const revoke = useCallback(
    async (grantId: string) => {
      if (isRevokingId) return false
      setIsRevokingId(grantId)
      try {
        await service.revoke(grantId)
        await fetchItems()
        return true
      } catch (revokeError) {
        setError(toUserToastMessage(revokeError))
        return false
      } finally {
        setIsRevokingId(null)
      }
    },
    [fetchItems, isRevokingId, service]
  )

  const applySendingHealthAction = useCallback(
    async (teamId: string, action: SendingHealthAction) => {
      if (isApplyingHealthTeamId) return false
      setIsApplyingHealthTeamId(teamId)
      try {
        await service.applySendingHealthAction(teamId, action)
        await fetchSendingHealth()
        return true
      } catch (actionError) {
        setError(toUserToastMessage(actionError))
        return false
      } finally {
        setIsApplyingHealthTeamId(null)
      }
    },
    [fetchSendingHealth, isApplyingHealthTeamId, service]
  )

  // Times bloqueados/alertados SEM limite customizado: fora da tabela de
  // grants eles não teriam onde ser liberados pelo suporte.
  const grantedTeamIds = new Set(grants.map((grantItem) => grantItem.teamId))
  const unlistedSendingHealth = Object.values(sendingHealthByTeamId)
    .filter((team) => !grantedTeamIds.has(team.teamId))
    .sort((left, right) => left.teamName.localeCompare(right.teamName, "pt-BR"))

  return {
    grants,
    sendingHealthByTeamId,
    unlistedSendingHealth,
    isLoading,
    error,
    isGranting,
    isRevokingId,
    isApplyingHealthTeamId,
    fetchItems,
    searchTeams,
    grant,
    revoke,
    applySendingHealthAction,
  }
}
