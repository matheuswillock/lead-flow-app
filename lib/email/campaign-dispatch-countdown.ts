/**
 * Countdown de disparo manual (lista + ficha).
 *
 * Feedback só — não substitui o POST. Retry usa copy de falhas apenas quando
 * `isCampaignFailedRetry` (totalSent > 0).
 */

export const CAMPAIGN_DISPATCH_COUNTDOWN_START_SECONDS = 5 as const
export const CAMPAIGN_DISPATCH_COUNTDOWN_TICK_MS = 1000
export const CAMPAIGN_DISPATCH_COUNTDOWN_DISPATCHED_LABEL = "Disparado"

export type CampaignDispatchCountdownStep = 5 | 4 | 3 | 2 | 1 | "dispatched"

export function shouldShowCampaignDispatchCountdownLoader(
  step: CampaignDispatchCountdownStep | null
): boolean {
  return step !== null && step !== "dispatched"
}

export function formatCampaignDispatchCountdownLabel(
  step: CampaignDispatchCountdownStep,
  isFailedRetry: boolean
): string {
  if (step === "dispatched") return CAMPAIGN_DISPATCH_COUNTDOWN_DISPATCHED_LABEL

  const secondsPhrase = step === 1 ? "1 segundo" : `${step} segundos`
  if (isFailedRetry) {
    return `Reenviando falhas em ${secondsPhrase}`
  }
  return `Disparando em ${secondsPhrase}`
}

export function nextCampaignDispatchCountdownStep(
  step: CampaignDispatchCountdownStep
): CampaignDispatchCountdownStep | "fire" {
  if (step === "dispatched") return "fire"
  if (step === 1) return "dispatched"
  return (step - 1) as 4 | 3 | 2 | 1
}

export function campaignDispatchCountdownSequence(
  isFailedRetry: boolean
): string[] {
  const ticks: CampaignDispatchCountdownStep[] = [5, 4, 3, 2, 1, "dispatched"]
  return ticks.map((step) => formatCampaignDispatchCountdownLabel(step, isFailedRetry))
}
