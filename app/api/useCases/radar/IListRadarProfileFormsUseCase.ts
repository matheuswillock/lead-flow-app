import type { Output } from "@/lib/output"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"

export type ListRadarProfileFormsInput = {
  teamId: string
  ctx: TeamContext
  profileId: string
}

export interface IListRadarProfileFormsUseCase {
  execute(input: ListRadarProfileFormsInput): Promise<Output>
}
