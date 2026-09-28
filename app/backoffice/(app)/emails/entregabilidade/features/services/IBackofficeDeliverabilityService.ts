import type { BackofficeDeliverabilityTeam } from "../context/BackofficeDeliverabilityTypes"

export interface IBackofficeDeliverabilityService {
  list(filters: { days: 7 | 30 | 90; teamId?: string; domain?: string; provider?: string }): Promise<BackofficeDeliverabilityTeam[]>
}
