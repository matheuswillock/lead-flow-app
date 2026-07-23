import type { TeamRadarSegmentSelect } from "@/app/api/infra/data/repositories/radar/TeamRadarSegmentRepository"
import type { RadarSegmentRules } from "@/lib/radar/segment-dsl"

export type TeamRadarSegmentInput = {
  name: string
  description?: string | null
  rules: RadarSegmentRules
}

export type TeamRadarSegmentUpdateInput = {
  name?: string
  description?: string | null
  rules?: RadarSegmentRules
  isActive?: boolean
}

export interface ITeamRadarSegmentService {
  listByTeam(teamId: string, options?: { onlyActive?: boolean }): Promise<TeamRadarSegmentSelect[]>
  findById(teamId: string, segmentId: string): Promise<TeamRadarSegmentSelect | null>
  create(teamId: string, createdBy: string, input: TeamRadarSegmentInput): Promise<TeamRadarSegmentSelect>
  update(
    teamId: string,
    segmentId: string,
    input: TeamRadarSegmentUpdateInput
  ): Promise<TeamRadarSegmentSelect | null>
  remove(teamId: string, segmentId: string): Promise<{ removed: boolean; softDeleted: boolean }>
}
