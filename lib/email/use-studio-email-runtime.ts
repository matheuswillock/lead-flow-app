"use client"

import { useOptionalTeamContext } from "@/app/context/TeamContext"
import { useOptionalStudioEmailHost, type StudioEmailHost } from "./studio-email-host"

export function useStudioEmailRuntime(explicitHost?: StudioEmailHost | null) {
  const hostFromContext = useOptionalStudioEmailHost()
  const host = explicitHost ?? hostFromContext
  const teamCtx = useOptionalTeamContext()

  return {
    host,
    teamId: host?.teamId ?? teamCtx?.activeTeamId ?? null,
    activeRole: host?.activeRole ?? teamCtx?.activeRole ?? null,
    teamLoading: host ? false : (teamCtx?.isLoading ?? true),
    hideRadarSegments: host?.flags?.hideRadarSegments ?? false,
    bypassCreditsCheck: host?.flags?.bypassCreditsCheck ?? false,
    skipBetaGate: host?.flags?.skipBetaGate ?? false,
  }
}
