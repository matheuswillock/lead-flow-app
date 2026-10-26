"use client"

import { useEffect, useState } from "react"
import type { IPublicFormShareBaseUrlClientService } from "./IPublicFormShareBaseUrlClientService"
import { publicFormShareBaseUrlClientService } from "./PublicFormShareBaseUrlClientService"

export type PublicFormDomainStatus = {
  isLoading: boolean
  isVerified: boolean
  hostname: string | null
}

export function usePublicFormDomainStatus(
  teamId: string | null | undefined,
  service: IPublicFormShareBaseUrlClientService = publicFormShareBaseUrlClientService,
): PublicFormDomainStatus {
  const [status, setStatus] = useState<PublicFormDomainStatus>({
    isLoading: Boolean(teamId),
    isVerified: false,
    hostname: null,
  })
  const [resolvedTeamId, setResolvedTeamId] = useState<string | null>(null)

  useEffect(() => {
    if (!teamId) {
      setResolvedTeamId(null)
      setStatus({ isLoading: false, isVerified: false, hostname: null })
      return
    }

    let active = true
    setStatus((current) => ({ ...current, isLoading: true }))
    void service
      .getFormDomain()
      .then((domain) => {
        if (!active) return
        setResolvedTeamId(teamId)
        setStatus({ ...domain, isLoading: false })
      })
      .catch(() => {
        if (!active) return
        setResolvedTeamId(teamId)
        setStatus({ isLoading: false, isVerified: false, hostname: null })
      })

    return () => {
      active = false
    }
  }, [service, teamId])

  return {
    ...status,
    isLoading: Boolean(teamId) && resolvedTeamId !== teamId,
  }
}
