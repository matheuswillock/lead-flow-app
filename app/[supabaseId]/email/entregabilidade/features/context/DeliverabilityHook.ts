"use client"

import { useCallback, useEffect, useState } from "react"
import { DeliverabilityService } from "../services/DeliverabilityService"
import type { DeliverabilityDashboard } from "./DeliverabilityTypes"

const service = new DeliverabilityService()

export function useDeliverabilityDashboard() {
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [senderDomain, setSenderDomain] = useState("")
  const [recipientProvider, setRecipientProvider] = useState("")
  const [campaignId, setCampaignId] = useState("")
  const [dashboard, setDashboard] = useState<DeliverabilityDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDashboard(await service.getDashboard({
        days,
        senderDomain: senderDomain || undefined,
        recipientProvider: recipientProvider || undefined,
        campaignId: campaignId.trim() || undefined,
      }))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a entrega")
    } finally {
      setLoading(false)
    }
  }, [campaignId, days, recipientProvider, senderDomain])

  useEffect(() => { void load() }, [load])

  return {
    days,
    setDays,
    senderDomain,
    setSenderDomain,
    recipientProvider,
    setRecipientProvider,
    campaignId,
    setCampaignId,
    dashboard,
    loading,
    error,
    reload: load,
  }
}
