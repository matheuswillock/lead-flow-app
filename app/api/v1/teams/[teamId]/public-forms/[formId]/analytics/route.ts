import { NextRequest } from "next/server"
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { outputResponse, resolvePublicFormsAccess } from "../../_utils"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; formId: string }> },
) {
  const values = await params
  const resolved = await resolvePublicFormsAccess(request, Promise.resolve(values))
  if ("response" in resolved) return resolved.response
  const query = request.nextUrl.searchParams
  return outputResponse(
    await publicFormsUseCase.analytics(
      resolved.access,
      values.formId,
      query.get("from") ? new Date(query.get("from")!) : undefined,
      query.get("to") ? new Date(query.get("to")!) : undefined,
      query.get("publicationId") || undefined,
    ),
  )
}
