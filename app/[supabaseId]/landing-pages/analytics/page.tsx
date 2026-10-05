"use client"

import { useParams } from "next/navigation"
import { useMemo } from "react"
import { useTeamContext } from "@/app/context/TeamContext"
import { useUserContext } from "@/app/context/UserContext"
import { LandingAnalyticsDashboard } from "../features/components/analytics/LandingAnalyticsDashboard"

export default function LandingAnalyticsPage() {
  const params = useParams<{ supabaseId: string }>()
  const { activeTeamId } = useTeamContext()
  const { user } = useUserContext()
  const headers = useMemo(() => ({ "x-supabase-user-id": user?.supabaseId ?? params.supabaseId, "x-team-id": activeTeamId ?? "" }), [activeTeamId, params.supabaseId, user?.supabaseId])
  if (!activeTeamId) return null
  return <LandingAnalyticsDashboard teamId={activeTeamId} headers={headers} />
}
