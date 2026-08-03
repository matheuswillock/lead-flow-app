"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { IBackofficeTeamEmailLimitService } from "../services/IBackofficeTeamEmailLimitService"
import type { IBackofficeTeamEmailLimitContext } from "./BackofficeTeamEmailLimitTypes"

export function useBackofficeTeamEmailLimitHook(
  service: IBackofficeTeamEmailLimitService
): IBackofficeTeamEmailLimitContext {
  const [grants, setGrants] = useState<IBackofficeTeamEmailLimitContext["grants"]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGranting, setIsGranting] = useState(false)
  const [isRevokingId, setIsRevokingId] = useState<string | null>(null)
  const inFlightRef = useRef(false)

  const fetchItems = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setIsLoading(true)
    setError(null)
    try {
      const result = await service.list()
      setGrants(result.grants)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar limites")
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }, [service])

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
        setError(grantError instanceof Error ? grantError.message : "Erro ao conceder limite")
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
        setError(revokeError instanceof Error ? revokeError.message : "Erro ao revogar limite")
        return false
      } finally {
        setIsRevokingId(null)
      }
    },
    [fetchItems, isRevokingId, service]
  )

  return {
    grants,
    isLoading,
    error,
    isGranting,
    isRevokingId,
    fetchItems,
    searchTeams,
    grant,
    revoke,
  }
}
