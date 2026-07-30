import type { EmailLog, LogDetail } from "@/app/[supabaseId]/email/historico/features/context/HistoricoTypes"
import type {
  StudioEmailHistoricoListParams,
  StudioEmailHistoricoListResult,
  StudioEmailHistoricoService,
} from "@/lib/email/studio-email-service-contracts"
import { parseStudioEmailOutput, studioEmailBasePath } from "@/lib/email/backoffice-studio-email-api"

export class BackofficeHistoricoService implements StudioEmailHistoricoService {
  constructor(
    private readonly masterId: string,
    private readonly teamId: string
  ) {}

  private base(): string {
    return `${studioEmailBasePath(this.masterId, this.teamId)}/logs`
  }

  async getLogs(params: StudioEmailHistoricoListParams): Promise<StudioEmailHistoricoListResult> {
    const query = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
    })
    if (params.search) query.set("search", params.search)
    if (params.status) query.set("status", params.status)
    if (params.category) query.set("category", params.category)
    if (params.from) query.set("from", params.from)
    if (params.to) query.set("to", params.to)
    const response = await fetch(`${this.base()}?${query}`)
    const result = await parseStudioEmailOutput<{
      items?: EmailLog[]
      logs?: EmailLog[]
      total: number
      page: number
      pageSize: number
      totalPages: number
    }>(response)
    return {
      logs: result.logs ?? result.items ?? [],
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    }
  }

  async getLogDetail(logId: string): Promise<LogDetail> {
    const response = await fetch(`${this.base()}/${logId}`)
    return parseStudioEmailOutput<LogDetail>(response)
  }
}
