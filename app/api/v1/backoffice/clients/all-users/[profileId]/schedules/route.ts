import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import type { ScheduleMeetingStatus } from "@/lib/lead-meeting"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeAllUsersUseCase } from "@/app/api/useCases/backoffice/BackofficeAllUsersUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const MEETING_STATUS_VALUES: ScheduleMeetingStatus[] = [
  "scheduled",
  "realized",
  "overdue",
  "canceled",
]

function parseMeetingStatuses(searchParams: URLSearchParams): ScheduleMeetingStatus[] {
  const values = [
    ...searchParams.getAll("meetingStatus"),
    ...(searchParams.get("meetingStatus")?.split(",") ?? []),
  ]
    .map((value) => value.trim())
    .filter((value): value is ScheduleMeetingStatus =>
      MEETING_STATUS_VALUES.includes(value as ScheduleMeetingStatus)
    )

  return [...new Set(values)]
}

function parseScheduleFunctions(searchParams: URLSearchParams): Array<"sdr" | "closer"> {
  const values = [
    ...searchParams.getAll("function"),
    ...(searchParams.get("function")?.split(",") ?? []),
    ...searchParams.getAll("role"),
    ...(searchParams.get("role")?.split(",") ?? []),
  ]
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is "sdr" | "closer" => value === "sdr" || value === "closer")

  return [...new Set(values)]
}

function parseLeadStatuses(searchParams: URLSearchParams): string[] {
  const values = [
    ...searchParams.getAll("leadStatus"),
    ...(searchParams.get("leadStatus")?.split(",") ?? []),
  ]
    .map((value) => value.trim())
    .filter(Boolean)

  return [...new Set(values)]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    console.info("[BackofficeAllUsersSchedulesRoute][GET] iniciado")

    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const { profileId } = await params
    const searchParams = request.nextUrl.searchParams

    const page = Number.parseInt(searchParams.get("page") ?? "1", 10)
    const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "10", 10)
    const query = searchParams.get("q")?.trim() || undefined
    const functions = parseScheduleFunctions(searchParams)
    const meetingStatuses = parseMeetingStatuses(searchParams)
    const leadStatuses = parseLeadStatuses(searchParams)
    const dateFromRaw = searchParams.get("dateFrom")
    const dateToRaw = searchParams.get("dateTo")
    const dateFrom = dateFromRaw ? new Date(dateFromRaw) : undefined
    const dateTo = dateToRaw ? new Date(dateToRaw) : undefined

    const output = await backofficeAllUsersUseCase.getSchedules(profileId, {
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 10,
      filters: {
        query,
        functions: functions.length > 0 ? functions : undefined,
        meetingStatuses: meetingStatuses.length > 0 ? meetingStatuses : undefined,
        leadStatuses: leadStatuses.length > 0 ? leadStatuses : undefined,
        dateFrom: dateFrom && !Number.isNaN(dateFrom.getTime()) ? dateFrom : undefined,
        dateTo: dateTo && !Number.isNaN(dateTo.getTime()) ? dateTo : undefined,
      },
    })

    return NextResponse.json(output, {
      status: output.isValid ? 200 : output.errorMessages.includes("Usuário não encontrado") ? 404 : 400,
    })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeAllUsersSchedulesRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
