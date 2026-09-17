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

  const fetchSendingHealth = useCallback(
    async (teamIds: string[]) => {
      if (teamIds.length === 0) {
        setSendingHealthByTeamId({})
        return
      }
      try {
        const result = await service.listSendingHealth(teamIds)
        const byTeamId: Record<string, TeamSendingHealthItem> = {}
        for (const team of result.teams) byTeamId[team.teamId] = team
        setSendingHealthByTeamId(byTeamId)
      } catch (healthError) {
        // Coluna informativa: falha aqui não pode derrubar a tela de limites.
        console.error("[useBackofficeTeamEmailLimitHook] fetchSendingHealth", healthError)
      }
    },
    [service]
  )

  const fetchItems = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setIsLoading(true)
    setError(null)
    try {
      const result = await service.list()
      setGrants(result.grants)
      await fetchSendingHealth(result.grants.map((grantItem) => grantItem.teamId))
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
        await fetchSendingHealth(grants.map((grantItem) => grantItem.teamId))
        return true
      } catch (actionError) {
        setError(toUserToastMessage(actionError))
        return false
      } finally {
        setIsApplyingHealthTeamId(null)
      }
    },
    [fetchSendingHealth, grants, isApplyingHealthTeamId, service]
  )

  return {
    grants,
    sendingHealthByTeamId,
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
