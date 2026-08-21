"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { IBackofficeOperationalAccessService } from "../services/IBackofficeOperationalAccessService"
import type { IBackofficeOperationalAccessContext } from "./BackofficeOperationalAccessTypes"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"

export function useBackofficeOperationalAccessHook(
  service: IBackofficeOperationalAccessService
): IBackofficeOperationalAccessContext {
  const [associadosQueue, setAssociadosQueue] = useState<
    IBackofficeOperationalAccessContext["associadosQueue"]
  >([])
  const [multiskillOrigins, setMultiskillOrigins] = useState<
    IBackofficeOperationalAccessContext["multiskillOrigins"]
  >([])
  const [eligibleAssociadosProfiles, setEligibleAssociadosProfiles] = useState<
    IBackofficeOperationalAccessContext["eligibleAssociadosProfiles"]
  >([])
  const [eligibleMultiskillMasters, setEligibleMultiskillMasters] = useState<
    IBackofficeOperationalAccessContext["eligibleMultiskillMasters"]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGrantingAssociados, setIsGrantingAssociados] = useState(false)
  const [isGrantingMultiskill, setIsGrantingMultiskill] = useState(false)
  const [isRevokingId, setIsRevokingId] = useState<string | null>(null)

  const inFlightRef = useRef(false)

  const fetchItems = useCallback(async () => {
    if (inFlightRef.current) return

    inFlightRef.current = true
    setIsLoading(true)
    setError(null)
    try {
      const result = await service.list()
      setAssociadosQueue(result.associadosQueue)
      setMultiskillOrigins(result.multiskillOrigins)
      setEligibleAssociadosProfiles(result.eligibleAssociadosProfiles)
      setEligibleMultiskillMasters(result.eligibleMultiskillMasters)
    } catch (fetchError) {
      setError(toUserToastMessage(fetchError))
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }, [service])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  const grantAssociados = useCallback(
    async (profileId: string, notes?: string | null) => {
      if (isGrantingAssociados) return false
      setIsGrantingAssociados(true)
      try {
        await service.grantAssociados(profileId, notes)
        await fetchItems()
        return true
      } catch (grantError) {
        setError(toUserToastMessage(grantError))
        return false
      } finally {
        setIsGrantingAssociados(false)
      }
    },
    [fetchItems, isGrantingAssociados, service]
  )

  const grantMultiskill = useCallback(
    async (masterId: string, notes?: string | null) => {
      if (isGrantingMultiskill) return false
      setIsGrantingMultiskill(true)
      try {
        await service.grantMultiskill(masterId, notes)
        await fetchItems()
        return true
      } catch (grantError) {
        setError(toUserToastMessage(grantError))
        return false
      } finally {
        setIsGrantingMultiskill(false)
      }
    },
    [fetchItems, isGrantingMultiskill, service]
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

  return {
    associadosQueue,
    multiskillOrigins,
    eligibleAssociadosProfiles,
    eligibleMultiskillMasters,
    isLoading,
    error,
    isGrantingAssociados,
    isGrantingMultiskill,
    isRevokingId,
    fetchItems,
    grantAssociados,
    grantMultiskill,
    revoke,
  }
}
