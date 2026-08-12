import type { Output } from "@/lib/output"

export type DispatchScheduledCronUseCase = {
  recoverStuckSendingCampaigns: (now: Date) => Promise<number>
  resumeOrphanSendingDispatches: (options: { now: Date }) => Promise<number>
  dispatchScheduledCampaigns: () => Promise<Output>
}

/**
 * Orquestra um tick do cron `dispatch-scheduled`.
 *
 * `recoverStuck` roda **antes** de `resumeOrphan` para que dispatches
 * `sending` com mais de 30 min sejam marcados `failed` mesmo quando o
 * resume de órfãos recentes consome o `maxDuration` da rota (60s).
 */
export async function runDispatchScheduledCronTick(
  useCase: DispatchScheduledCronUseCase,
  now = new Date()
): Promise<Output> {
  await useCase.recoverStuckSendingCampaigns(now)
  await useCase.resumeOrphanSendingDispatches({ now })
  return useCase.dispatchScheduledCampaigns()
}
