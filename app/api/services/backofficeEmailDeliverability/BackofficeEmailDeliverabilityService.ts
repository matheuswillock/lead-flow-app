import {
  backofficeEmailDeliverabilityRepository,
  type BackofficeDeliverabilityFilters,
  type IBackofficeEmailDeliverabilityRepository,
} from "@/app/api/infra/data/repositories/backofficeEmailDeliverability/BackofficeEmailDeliverabilityRepository"

export interface IBackofficeEmailDeliverabilityService {
  getDashboard(filters: BackofficeDeliverabilityFilters): Promise<unknown>
}

export class BackofficeEmailDeliverabilityService implements IBackofficeEmailDeliverabilityService {
  constructor(
    private readonly repository: IBackofficeEmailDeliverabilityRepository = backofficeEmailDeliverabilityRepository
  ) {}

  async getDashboard(filters: BackofficeDeliverabilityFilters) {
    const rows = await this.repository.list(filters)
    const groups = new Map<string, typeof rows>()
    for (const row of rows) groups.set(row.teamId, [...(groups.get(row.teamId) ?? []), row])
    const teams = [...groups.entries()].map(([teamId, teamRows]) => {
      const sent = teamRows.reduce((sum, row) => sum + row.sent, 0)
      const delivered = teamRows.reduce((sum, row) => sum + row.delivered, 0)
      const bounced = teamRows.reduce((sum, row) => sum + row.hardBounced + row.softBounced, 0)
      const complained = teamRows.reduce((sum, row) => sum + row.complained, 0)
      return {
        teamId,
        teamName: teamRows[0]?.teamName ?? "Time sem nome",
        sent,
        delivered,
        bounced,
        complained,
        deliveryRate: delivered / Math.max(1, sent),
        bounceRate: bounced / Math.max(1, sent),
        complaintRate: complained / Math.max(1, sent),
      }
    }).sort((left, right) => right.bounceRate - left.bounceRate)
    return { teams }
  }
}

export const backofficeEmailDeliverabilityService = new BackofficeEmailDeliverabilityService()
