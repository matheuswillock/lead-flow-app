"use client"

import { useEffect, useState } from "react"
import { BackofficeDeliverabilityService } from "../services/BackofficeDeliverabilityService"
import type { BackofficeDeliverabilityTeam } from "./BackofficeDeliverabilityTypes"

const service = new BackofficeDeliverabilityService()

export function useBackofficeDeliverability() {
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [teamId, setTeamId] = useState("")
  const [domain, setDomain] = useState("")
  const [provider, setProvider] = useState("")
  const [teams, setTeams] = useState<BackofficeDeliverabilityTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    service.list({ days, teamId: teamId.trim() || undefined, domain: domain.trim() || undefined, provider: provider.trim() || undefined })
      .then((result) => { if (active) setTeams(result) })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Falha ao carregar reputação") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [days, domain, provider, teamId])

  return { days, setDays, teamId, setTeamId, domain, setDomain, provider, setProvider, teams, loading, error }
}
