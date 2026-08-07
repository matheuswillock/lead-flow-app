import { Output } from "@/lib/output"
import { API_CLIENT_BASE } from "@/lib/route-map"
import type { ICronExecutionsService, ListCronExecutionsParams } from "./ICronExecutionsService"

export class CronExecutionsService implements ICronExecutionsService {
  async listExecutions(params?: ListCronExecutionsParams): Promise<Output> {
    const searchParams = new URLSearchParams()
    
    if (params?.cronKey) searchParams.append("cronKey", params.cronKey)
    if (params?.status) searchParams.append("status", params.status)
    if (params?.startDate) searchParams.append("startDate", params.startDate)
    if (params?.endDate) searchParams.append("endDate", params.endDate)
    if (params?.limit) searchParams.append("limit", params.limit.toString())

    const response = await fetch(`${API_CLIENT_BASE}/backoffice/cron-executions?${searchParams}`)
    return response.json()
  }
}
