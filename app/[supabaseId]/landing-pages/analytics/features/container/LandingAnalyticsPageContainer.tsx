"use client"

import { LandingAnalyticsDashboard } from "../../../features/components/analytics/LandingAnalyticsDashboard"

export function LandingAnalyticsPageContainer({ teamId, headers }: { teamId: string; headers: HeadersInit }) {
  return <LandingAnalyticsDashboard teamId={teamId} headers={headers} />
}
