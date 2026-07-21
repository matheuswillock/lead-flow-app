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
  const date = request.nextUrl.searchParams.get("date")
  if (!date) {
    return NextResponse.json(new Output(false, [], ["Informe a data"], null), {
      status: 400,
    })
  }
  const contextOutput = await publicFormsUseCase.getAvailabilityContext(publicId)
  const current = contextOutput.result as {
    snapshot: PublicFormSnapshot
    teamId: string
    team: { master: { timezone: string } }
  } | null
  if (!current || !current.snapshot.schedulingEnabled || current.snapshot.eligibleCloserIds.length === 0) {
    return NextResponse.json(new Output(false, [], ["Disponibilidade não encontrada"], null), {
      status: 404,
    })
  }

  const slotMap = new Map<string, { time: string; startsAt: string }>()
  for (const closerId of current.snapshot.eligibleCloserIds) {
    const output = await publicLeadFormUseCase.getCloserAvailability(
      current.teamId,
      closerId,
      date,
      undefined,
      current.snapshot.meetingDurationMinutes,
    )
    if (!output.isValid) continue
    const result = output.result as { availableTimes?: string[] }
    for (const time of result.availableTimes ?? []) {
      if (slotMap.has(time)) continue
      slotMap.set(time, {
        time,
        startsAt: parseDateKeyAndTimeToUtc(date, time, current.team.master.timezone).toISOString(),
      })
    }
  }

  const availableSlots = Array.from(slotMap.values()).sort((a, b) => a.time.localeCompare(b.time))
  return NextResponse.json(new Output(true, [], [], { availableSlots }))
}
