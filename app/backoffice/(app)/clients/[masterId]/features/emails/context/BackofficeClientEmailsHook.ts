"use client"

import { useCallback, useMemo, useState } from "react"
import type {
  BackofficeClientEmailsContextValue,
  EmailSection,
  TeamOption,
} from "./BackofficeClientEmailsTypes"

export interface UseBackofficeClientEmailsHookProps {
  masterId: string
  teams: TeamOption[]
  selectedTeamId: string | null
  onSelectedTeamIdChange: (teamId: string | null) => void
  canManage: boolean
  emailSection: EmailSection
  setEmailSection: (section: EmailSection) => void
}

export function useBackofficeClientEmailsHook({
  masterId,
  teams,
  selectedTeamId,
  onSelectedTeamIdChange,
  canManage,
  emailSection,
  setEmailSection,
}: UseBackofficeClientEmailsHookProps): BackofficeClientEmailsContextValue {
  const [refreshKey, setRefreshKey] = useState(0)

  const bumpRefresh = useCallback(() => {
    setRefreshKey((current) => current + 1)
  }, [])

  return useMemo(
    () => ({
      masterId,
      teams,
      selectedTeamId,
      onSelectedTeamIdChange,
      canManage,
      emailSection,
      setEmailSection,
      refreshKey,
      bumpRefresh,
    }),
    [
      masterId,
      teams,
      selectedTeamId,
      onSelectedTeamIdChange,
      canManage,
      emailSection,
      setEmailSection,
      refreshKey,
      bumpRefresh,
    ]
  )
}
