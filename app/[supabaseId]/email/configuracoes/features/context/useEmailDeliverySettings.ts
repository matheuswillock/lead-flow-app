"use client"

import { useCallback, useState } from "react"
import type { EmailSettings } from "./EmailSettingsTypes"

export type EmailDeliverySettingsSnapshot = Pick<
  EmailSettings,
  | "sendingHealthStatus"
  | "dmarcStatus"
  | "warmupStatus"
  | "warmupStage"
  | "warmupLimit"
  | "warmupUsed"
  | "warmupReserved"
  | "warmupRemaining"
  | "domainTemperature"
  | "domainHealth"
  | "warmupReason"
  | "nextEvaluationAt"
>

export function useEmailDeliverySettings() {
  const [snapshot, setSnapshot] = useState<EmailDeliverySettingsSnapshot>({})
  const apply = useCallback((settings: EmailSettings) => {
    setSnapshot({
      sendingHealthStatus: settings.sendingHealthStatus,
      dmarcStatus: settings.dmarcStatus,
      warmupStatus: settings.warmupStatus,
      warmupStage: settings.warmupStage,
      warmupLimit: settings.warmupLimit,
      warmupUsed: settings.warmupUsed,
      warmupReserved: settings.warmupReserved,
      warmupRemaining: settings.warmupRemaining,
      domainTemperature: settings.domainTemperature,
      domainHealth: settings.domainHealth,
      warmupReason: settings.warmupReason,
      nextEvaluationAt: settings.nextEvaluationAt,
    })
  }, [])

  return { snapshot, apply }
}
