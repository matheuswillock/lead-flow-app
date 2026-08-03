import type { EmailLog, LogDetail } from '../context/HistoricoTypes'
import { API_CLIENT_BASE } from "@/lib/route-map";

type ListParams = {
  page: number
  pageSize: number
  search?: string
  status?: string
  category?: string
  from?: string
  to?: string
}

type ListResult = {
  logs: EmailLog[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface IHistoricoService {
  getLogs(params: ListParams): Promise<ListResult>
  getLogDetail(logId: string): Promise<LogDetail>
}

export class HistoricoService implements IHistoricoService {
  private readonly baseUrl = `${API_CLIENT_BASE}/email/logs`

  async getLogs(params: ListParams): Promise<ListResult> {
    const query = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
    })
    if (params.search) query.set('search', params.search)
    if (params.status) query.set('status', params.status)
    if (params.category) query.set('category', params.category)
    if (params.from) query.set('from', params.from)
    if (params.to) query.set('to', params.to)

    const res = await fetch(`${this.baseUrl}?${query}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as ListResult
  }

  async getLogDetail(logId: string): Promise<LogDetail> {
    const res = await fetch(`${this.baseUrl}/${logId}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as LogDetail
  }
}
