"use client"

import { useState, useEffect } from "react"
import { API_CLIENT_BASE } from "@/lib/route-map";

interface BillingSlots {
  hasAvailableTeamSlot: boolean
  hasAvailableUserSlot: boolean
}

export function useBillingSlots(supabaseId: string, enabled: boolean): BillingSlots {
  const [slots, setSlots] = useState<BillingSlots>({
    hasAvailableTeamSlot: false,
    hasAvailableUserSlot: false,
  })

  useEffect(() => {
    if (!enabled || !supabaseId) return

    fetch(`${API_CLIENT_BASE}/billing/summary`, {
      headers: { "x-supabase-user-id": supabaseId },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.isValid && data.result) {
          const { availableExtraTeams, availableExtraUsers, hasPermanentSubscription, hasUnlimitedUsers } = data.result
          setSlots({
            hasAvailableTeamSlot: hasPermanentSubscription || availableExtraTeams > 0,
            hasAvailableUserSlot: hasPermanentSubscription || hasUnlimitedUsers || availableExtraUsers > 0,
          })
        }
      })
      .catch(() => {})
  }, [supabaseId, enabled])

  return slots
}
