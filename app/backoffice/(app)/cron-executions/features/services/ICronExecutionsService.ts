import type { BackofficeCronStatus } from "@prisma/client"
import type { Output } from "@/lib/output"

export type ListCronExecutionsParams = {
  cronKey?: string
  status?: BackofficeCronStatus
  startDate?: string
  endDate?: string
  limit?: number
}

export interface ICronExecutionsService {
  listExecutions(params?: ListCronExecutionsParams): Promise<Output>
}
