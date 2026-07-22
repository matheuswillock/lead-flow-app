import { z } from "zod"
import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeCalendarAvailabilityUseCase } from "@/app/api/useCases/backofficeCalendarAvailability/BackofficeCalendarAvailabilityUseCase"

const schema = z.object({
  closerId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const validation = schema.safeParse(body)
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

    const output = await backofficeCalendarAvailabilityUseCase.getAvailability({
      closerIds: [validation.data.closerId],
      date: validation.data.date,
      days: 1,
      userTimezone: validation.data.timezone,
    })

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficePublicLeadFormAvailabilityRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
