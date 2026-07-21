import type { NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import {
  getTeamAccess,
  isManagerOrMaster,
  type TeamAccess,
  type TeamAccessResult,
} from "@/app/api/v1/utils/teamAccess"
import { featureAccessUseCase } from "@/app/api/useCases/featureAccess/FeatureAccessUseCase"

export type RadarAccessResult =
  | { access: TeamAccess; error?: never; status?: never }
  | { access?: never; error: Output; status: number }

export async function getRadarAccess(request: NextRequest): Promise<RadarAccessResult> {
  const teamAccess: TeamAccessResult = await getTeamAccess(request)
  if (teamAccess.error) {
    return { error: teamAccess.error, status: teamAccess.status }
  }

  if (!isManagerOrMaster(teamAccess.access)) {
    return {
      error: new Output(false, [], ["Acesso negado ao Radar"], null),
      status: 403,
    }
  }

  const featureOutput = await featureAccessUseCase.execute({
    profileId: teamAccess.access.profileId,
    managerId: teamAccess.access.managerId,
    activeTeamId: teamAccess.access.teamId,
    teamContext: {
      isMaster: teamAccess.access.isMaster,
      role: teamAccess.access.teamMember.role,
      functions: teamAccess.access.teamMember.functions,
      canManageAccountTeams: teamAccess.access.canManageAccountTeams,
      canCreateAccountUsers: teamAccess.access.canCreateAccountUsers,
    },
  })

  if (!featureOutput.isValid) {
    return {
      error: new Output(false, [], ["Não foi possível validar o acesso ao Radar"], null),
      status: 403,
    }
  }

  const slugs = (featureOutput.result as { slugs?: string[] } | null)?.slugs ?? []
  if (!slugs.includes(FEATURE_SLUGS.RADAR)) {
    return {
      error: new Output(false, [], ["Add-on Radar não está ativo para este time"], null),
      status: 403,
    }
  }

  return { access: teamAccess.access }
}

export function teamContextFromRadarAccess(access: TeamAccess) {
  return {
    profileId: access.profileId,
    userTimezone: access.userTimezone,
    teamMember: {
      role: access.teamMember.role,
      functions: access.teamMember.functions,
    },
  }
}
