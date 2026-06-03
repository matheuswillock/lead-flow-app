import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { BackofficeEmailSettingsUseCase } from "@/app/api/useCases/backoffice/BackofficeEmailSettingsUseCase"

const dateRe = /^\d{4}-\d{2}-\d{2}$/
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/
const updateSchema = z.object({
  fromName: z.string().min(1).max(100).optional(),
  fromEmail: z.string().email().optional(),
  replyTo: z.string().email().nullable().optional(),
  dispatchBlockedDates: z.array(
    z.union([
      z.object({ date: z.string().regex(dateRe) }),
      z.object({ from: z.string().regex(dateRe), to: z.string().regex(dateRe) }),
    ])
  ).nullable().optional(),
  dispatchTimeFrom: z.string().regex(timeRe).nullable().optional(),
  dispatchTimeTo: z.string().regex(timeRe).nullable().optional(),
  dispatchAllowedRoles: z.array(z.enum(["manager", "backoffice", "operator"])).optional(),
  templateCreateRoles: z.array(z.enum(["manager", "backoffice", "operator"])).optional(),
  templateApprovalRequired: z.boolean().optional(),
})

const useCase = new BackofficeEmailSettingsUseCase()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }

    const output = await useCase.getByTeamId(teamId)
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    console.error("[BackofficeEmailSettingsByTeamRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }

    const body = await request.json().catch(() => null)
    const validation = updateSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 })
    }

    const output = await useCase.update(teamId, validation.data)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeEmailSettingsByTeamRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
