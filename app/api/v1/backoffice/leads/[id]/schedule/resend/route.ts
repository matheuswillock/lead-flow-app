import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeLeadScheduleUseCase } from "@/app/api/useCases/backofficeLeadSchedule/BackofficeLeadScheduleUseCase"

const resendSchema = z.object({
  target: z.enum(["all", "single", "new"]),
  email: z.string().email().optional(),
  emails: z.array(z.string().email()).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }
    const denied = requireManagerAccess(accessResult.access)
    if (denied) return denied

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const validation = resendSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        new Output(
          false,
          [],
          validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
          null
        ),
        { status: 400 }
      )
    }

    const output = await backofficeLeadScheduleUseCase.resendInvite({
      leadId: id,
      target: validation.data.target,
      email: validation.data.email,
      emails: validation.data.emails,
    })

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeLeadScheduleResendRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
