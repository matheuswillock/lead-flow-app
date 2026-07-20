import { NextRequest, NextResponse } from "next/server"
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { publicLeadFormUseCase } from "@/app/api/useCases/integrations/PublicLeadFormUseCase"
import { parseDateKeyAndTimeToUtc } from "@/lib/dates"
import { Output } from "@/lib/output"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params
  const closerId = request.nextUrl.searchParams.get("closerId")
  const date = request.nextUrl.searchParams.get("date")
  if (!closerId || !date) {
    return NextResponse.json(new Output(false, [], ["Informe o closer e a data"], null), {
      status: 400,
    })
  }
  const contextOutput = await publicFormsUseCase.getAvailabilityContext(publicId)
  const current = contextOutput.result as {
    snapshot: PublicFormSnapshot
    teamId: string
    team: { master: { timezone: string } }
  } | null
  if (
    !current ||
    !current.snapshot.schedulingEnabled ||
    !current.snapshot.eligibleCloserIds.includes(closerId)
  ) {
    return NextResponse.json(new Output(false, [], ["Disponibilidade não encontrada"], null), {
      status: 404,
    })
  }
  const output = await publicLeadFormUseCase.getCloserAvailability(
    current.teamId,
    closerId,
    date,
    undefined,
    current.snapshot.meetingDurationMinutes,
  )
  if (!output.isValid) return NextResponse.json(output, { status: 400 })
  const result = output.result as { availableTimes?: string[]; source?: string }
  return NextResponse.json(
    new Output(true, [], [], {
      availableSlots: (result.availableTimes ?? []).map((time) => ({
        time,
        startsAt: parseDateKeyAndTimeToUtc(date, time, current.team.master.timezone).toISOString(),
      })),
      source: result.source,
    }),
  )
}
