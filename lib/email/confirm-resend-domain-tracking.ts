import type { ResendDomainSnapshot } from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"

export type ResendDomainTrackingFetcher = () => Promise<{
  data: ResendDomainSnapshot | null
  error: unknown | null
}>

export type ResendDomainTrackingConfirmation = {
  confirmed: boolean
  snapshot: ResendDomainSnapshot | null
  error: unknown | null
}

const CONFIRMATION_DELAYS_MS = [0, 250, 750] as const

export function waitForResendTrackingConfirmation(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

function matchesTrackingState(
  snapshot: ResendDomainSnapshot,
  desired: { openTracking: boolean; clickTracking: boolean }
): boolean {
  const openTracking = Boolean(snapshot.openTracking ?? snapshot.open_tracking)
  const clickTracking = Boolean(snapshot.clickTracking ?? snapshot.click_tracking)
  return openTracking === desired.openTracking && clickTracking === desired.clickTracking
}

export async function confirmResendDomainTracking(options: {
  desired: { openTracking: boolean; clickTracking: boolean }
  fetchDomain: ResendDomainTrackingFetcher
  wait?: (delayMs: number) => Promise<void>
}): Promise<ResendDomainTrackingConfirmation> {
  const wait = options.wait ?? waitForResendTrackingConfirmation
  let lastSnapshot: ResendDomainSnapshot | null = null
  let lastError: unknown | null = null

  for (const delayMs of CONFIRMATION_DELAYS_MS) {
    if (delayMs > 0) await wait(delayMs)
    const result = await options.fetchDomain()
    if (result.data) lastSnapshot = result.data
    lastError = result.error
    if (result.data && !result.error && matchesTrackingState(result.data, options.desired)) {
      return { confirmed: true, snapshot: result.data, error: null }
    }
  }

  return { confirmed: false, snapshot: lastSnapshot, error: lastError }
}
