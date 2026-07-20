import { NextRequest } from "next/server"
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { outputResponse, resolvePublicFormsAccess } from "../../_utils"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; formId: string }> },
) {
  const values = await params
  const resolved = await resolvePublicFormsAccess(request, Promise.resolve(values))
  if ("response" in resolved) return resolved.response
  const body = (await request.json().catch(() => ({}))) as { comment?: string }
  return outputResponse(
    await publicFormsUseCase.reject(resolved.access, values.formId, body.comment ?? ""),
  )
}
