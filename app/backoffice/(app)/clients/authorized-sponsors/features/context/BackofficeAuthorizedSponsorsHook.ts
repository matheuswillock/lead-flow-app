"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { IBackofficeAuthorizedSponsorsContext } from "./BackofficeAuthorizedSponsorsTypes"
import type { IBackofficeAuthorizedSponsorsService } from "../services/IBackofficeAuthorizedSponsorsService"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"

export function useBackofficeAuthorizedSponsorsHook(
  service: IBackofficeAuthorizedSponsorsService
): IBackofficeAuthorizedSponsorsContext {
  const [items, setItems] = useState<IBackofficeAuthorizedSponsorsContext["items"]>([])
  const [eligibleMasters, setEligibleMasters] = useState<
    IBackofficeAuthorizedSponsorsContext["eligibleMasters"]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGranting, setIsGranting] = useState(false)
  const [isRevokingId, setIsRevokingId] = useState<string | null>(null)

  const inFlightRef = useRef(false)
  const lastSuccessKeyRef = useRef<string | null>(null)

  const fetchItems = useCallback(async () => {
    if (inFlightRef.current) return

    inFlightRef.current = true
    setIsLoading(true)
    setError(null)
    try {
      const result = await service.list()
      setItems(result.items)
      setEligibleMasters(result.eligibleMasters)
      lastSuccessKeyRef.current = "authorized-sponsors-list"
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

  const grant = useCallback(
    async (profileId: string, notes?: string | null) => {
      if (isGranting) return false
      setIsGranting(true)
      try {
        await service.grant(profileId, notes)
        lastSuccessKeyRef.current = null
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
    async (profileId: string) => {
      if (isRevokingId) return false
      setIsRevokingId(profileId)
      try {
        await service.revoke(profileId)
        lastSuccessKeyRef.current = null
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
    items,
    eligibleMasters,
    isLoading,
    error,
    isGranting,
    isRevokingId,
    fetchItems,
    grant,
    revoke,
  }
}
