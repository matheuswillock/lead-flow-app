import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import {
  backofficeLeadScheduleUseCase,
} from "@/app/api/useCases/backofficeLeadSchedule/BackofficeLeadScheduleUseCase"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const { id } = await params
    const output = await backofficeLeadScheduleUseCase.getAttendees(id)
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeLeadScheduleAttendeesRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
