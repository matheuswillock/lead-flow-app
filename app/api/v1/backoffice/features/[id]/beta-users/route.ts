import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { invalidateBackofficeFeaturesCache, invalidateFeatureAccessCache } from "@/lib/cache/invalidation"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficeFeatureUseCase } from "@/app/api/useCases/backofficeFeature/BackofficeFeatureUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

type BetaTeamScopeValue = "ALL_TEAMS" | "SPECIFIC_TEAMS"

function parseBetaTeamScope(value: unknown): BetaTeamScopeValue | null {
  if (value === "ALL_TEAMS" || value === "SPECIFIC_TEAMS") {
    return value
  }
  return null
}

function parseTeamIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

function invalidateBetaCaches(profileId: string) {
  invalidateBackofficeFeaturesCache()
  invalidateFeatureAccessCache({ profileId, managerId: profileId })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { id } = await params
    const output = await backofficeFeatureUseCase.listBetaUsers(id)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeFeatureBetaUsersRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireMasterAccess(result.access)
    if (denied) return denied

    const { id } = await params
    const body = (await request.json()) as {
      profileId?: string
      betaTeamScope?: unknown
      teamIds?: unknown
    }

    if (!body.profileId) {
      return NextResponse.json(new Output(false, [], ["profileId é obrigatório"], null), {
        status: 400,
      })
    }

    const betaTeamScope = parseBetaTeamScope(body.betaTeamScope) ?? "ALL_TEAMS"

    const output = await backofficeFeatureUseCase.addBetaUser(id, {
      profileId: body.profileId,
      betaTeamScope,
      teamIds: parseTeamIds(body.teamIds),
    })

    if (output.isValid) {
      invalidateBetaCaches(body.profileId)
    }

    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeFeatureBetaUsersRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireMasterAccess(result.access)
    if (denied) return denied

    const { id } = await params
    const body = (await request.json()) as {
      profileId?: string
      betaTeamScope?: unknown
      teamIds?: unknown
    }

    if (!body.profileId) {
      return NextResponse.json(new Output(false, [], ["profileId é obrigatório"], null), {
        status: 400,
      })
    }

    const betaTeamScope = parseBetaTeamScope(body.betaTeamScope)
    if (!betaTeamScope) {
      return NextResponse.json(new Output(false, [], ["betaTeamScope inválido"], null), {
        status: 400,
      })
    }

    const output = await backofficeFeatureUseCase.updateBetaUser(id, body.profileId, {
      betaTeamScope,
      teamIds: parseTeamIds(body.teamIds),
    })

    if (output.isValid) {
      invalidateBetaCaches(body.profileId)
    }

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeFeatureBetaUsersRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
