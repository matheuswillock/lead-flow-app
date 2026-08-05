import { type NextRequest } from "next/server"
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { outputResponse, resolvePublicFormsAccess } from "../_utils"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const resolved = await resolvePublicFormsAccess(request, params)
  if ("response" in resolved) return resolved.response
  return outputResponse(await publicFormsUseCase.listTemplates(resolved.access))
}
