import type { EmailLog, LogDetail } from '../context/HistoricoTypes'

export type GetLogsParams = {
  page: number
  pageSize: number
  search?: string
  status?: string
  from?: string
  to?: string
}

export type GetLogsResult = {
  logs: EmailLog[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface IHistoricoService {
  getLogs(params: GetLogsParams): Promise<GetLogsResult>
  getLogDetail(logId: string): Promise<LogDetail>
}
