import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficeMemberAccessEmailUseCase } from "@/app/api/useCases/backoffice/BackofficeMemberAccessEmailUseCase"

const bodySchema = z.object({
  mode: z.enum(["invite", "reset_password"]),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }
    const denied = requireMasterAccess(accessResult.access)
    if (denied) return denied

    const body = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!body.success) {
      return NextResponse.json(
        new Output(false, [], body.error.issues.map((issue) => issue.message), null),
        { status: 400 }
      )
    }

    const { memberId } = await params
    const output = await backofficeMemberAccessEmailUseCase.sendAccessEmail(
      memberId,
      body.data.mode
    )

    const status = output.isValid
      ? 200
      : output.errorMessages.includes("Membro não encontrado")
        ? 404
        : 400

    return NextResponse.json(output, { status })
  } catch (error) {
    console.error("[BackofficeMemberAccessEmailRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
