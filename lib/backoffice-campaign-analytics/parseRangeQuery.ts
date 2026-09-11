export type CampaignAnalyticsRangeQuery = {
  from: string | null
  to: string | null
  teamIds: string[] | undefined
}

export function parseCampaignAnalyticsRangeQuery(searchParams: URLSearchParams): CampaignAnalyticsRangeQuery {
  const teamIdsParam = searchParams.get("teamIds")
  const teamIds = teamIdsParam
    ? teamIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : undefined

  return {
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    teamIds: teamIds && teamIds.length > 0 ? teamIds : undefined,
  }
}

export function parseOptionalInt(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
