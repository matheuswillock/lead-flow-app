import { NextResponse, type NextRequest } from "next/server"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeEmailDeliverabilityUseCase } from "@/app/api/useCases/backofficeEmailDeliverability/BackofficeEmailDeliverabilityUseCase"

export async function GET(request: NextRequest) {
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const denied = requireManagerAccess(access.access)
  if (denied) return denied
  const params = request.nextUrl.searchParams
  const requestedDays = Number(params.get("days") ?? 30)
  const output = await backofficeEmailDeliverabilityUseCase.list({
    days: [7, 30, 90].includes(requestedDays) ? requestedDays : 30,
    teamId: params.get("teamId") || undefined,
    senderDomain: params.get("domain") || undefined,
    recipientProvider: params.get("provider") || undefined,
  })
  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}
