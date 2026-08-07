import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailTeamSettingsUseCase } from "@/app/api/useCases/email/EmailTeamSettingsUseCase"
import { isManagerLikeRole } from "@/lib/roles"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const dateRe = /^\d{4}-\d{2}-\d{2}$/
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/
const blockedDateSchema = z.union([
  z.object({ date: z.string().regex(dateRe) }),
  z.object({ from: z.string().regex(dateRe), to: z.string().regex(dateRe) }),
])

const updateSchema = z.object({
  dispatchBlockedDates: z.array(blockedDateSchema).nullable().optional(),
  dispatchTimeFrom: z.string().regex(timeRe).nullable().optional(),
  dispatchTimeTo: z.string().regex(timeRe).nullable().optional(),
  dispatchAllowedRoles: z.array(z.enum(["manager", "backoffice", "operator"])).optional(),
  templateCreateRoles: z.array(z.enum(["manager", "backoffice", "operator"])).optional(),
  templateApprovalRequired: z.boolean().optional(),
  templateApprovalRoles: z.array(z.enum(["manager", "backoffice", "operator"])).optional(),
  blockedDispatchDays: z.array(z.number().int().min(1).max(31)).nullable().optional(),
})

function makeUseCase() {
  return new EmailTeamSettingsUseCase()
}

export async function GET(request: NextRequest) {
  await connection();

  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const useCase = makeUseCase()
    const output = await useCase.get(teamAccess.access)
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailSettingsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem alterar configurações de email"], null),
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const validation = updateSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 })
    }

    const useCase = makeUseCase()
    const output = await useCase.update(validation.data, teamAccess.access)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailSettingsRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
