import { z } from "zod"
import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeCalendarAvailabilityUseCase } from "@/app/api/useCases/backofficeCalendarAvailability/BackofficeCalendarAvailabilityUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const schema = z
  .object({
    closerId: z.string().uuid().optional(),
    closerIds: z.array(z.string().uuid()).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    excludeLeadId: z.string().uuid().nullish(),
    timezone: z.string().optional(),
  })
  .refine((data) => data.closerId || (data.closerIds && data.closerIds.length > 0), {
    message: "Informe ao menos um closer",
    path: ["closerId"],
  })

export async function POST(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

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

    const { closerId, closerIds, date, excludeLeadId, timezone } = validation.data
    const requestedCloserIds = Array.from(
      new Set([...(closerIds ?? []), ...(closerId ? [closerId] : [])])
    )
    const output = await backofficeCalendarAvailabilityUseCase.getAvailability({
      closerIds: requestedCloserIds,
      date,
      excludeLeadId,
      userTimezone: timezone,
    })

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeCalendarAvailabilityRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
