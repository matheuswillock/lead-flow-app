import { backofficeCronSlackNotificationService } from "@/app/api/services/backofficeCronSlack/BackofficeCronSlackNotificationService"

export function getDefaultCronSlackCallback() {
  return async (params: {
    cronKey: string
    cronPath: string
    durationMs: number
    error: string
    executionId: string
  }) => {
    await backofficeCronSlackNotificationService.sendFailureAlertBestEffort(params)
  }
}
