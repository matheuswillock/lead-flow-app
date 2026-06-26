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

export type CdpAccessResult =
  | { access: TeamAccess; error?: never; status?: never }
  | { access?: never; error: Output; status: number }

export async function getCdpAccess(request: NextRequest): Promise<CdpAccessResult> {
  const teamAccess: TeamAccessResult = await getTeamAccess(request)
  if (teamAccess.error) {
    return { error: teamAccess.error, status: teamAccess.status }
  }

  if (!isManagerOrMaster(teamAccess.access)) {
    return {
      error: new Output(false, [], ["Acesso negado à CDP"], null),
      status: 403,
    }
  }

  const featureOutput = await featureAccessUseCase.execute({
    profileId: teamAccess.access.profileId,
    managerId: teamAccess.access.managerId,
  })

  if (!featureOutput.isValid) {
    return {
      error: new Output(false, [], ["Não foi possível validar o acesso à CDP"], null),
      status: 403,
    }
  }

  const slugs = (featureOutput.result as { slugs?: string[] } | null)?.slugs ?? []
  if (!slugs.includes(FEATURE_SLUGS.CDP)) {
    return {
      error: new Output(false, [], ["Add-on CDP não está ativo para este time"], null),
      status: 403,
    }
  }

  return { access: teamAccess.access }
}

export function teamContextFromCdpAccess(access: TeamAccess) {
  return {
    profileId: access.profileId,
    userTimezone: access.userTimezone,
    teamMember: {
      role: access.teamMember.role,
      functions: access.teamMember.functions,
    },
  }
}
