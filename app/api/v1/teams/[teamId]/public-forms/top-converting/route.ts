import { NextRequest, connection } from "next/server";
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { addDaysInTz, startOfDayInTz } from "@/lib/dates"
import { outputResponse, resolvePublicFormsAccess } from "../_utils"

function getDefaultFrom(tz: string): Date {
  return startOfDayInTz(addDaysInTz(new Date(), -30, tz), tz)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  await connection();

  const resolved = await resolvePublicFormsAccess(request, params)
  if ("response" in resolved) return resolved.response

  const query = request.nextUrl.searchParams
  const fromParam = query.get("from")
  const toParam = query.get("to")
  const from = fromParam ? new Date(fromParam) : getDefaultFrom(resolved.access.userTimezone)
  const to = toParam ? new Date(toParam) : new Date()

  return outputResponse(await publicFormsUseCase.topConverting(resolved.access, from, to))
}
