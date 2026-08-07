import { NextRequest, connection } from "next/server";
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { outputResponse, resolvePublicFormsAccess } from "../../_utils"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; formId: string }> },
) {
  await connection();

  const values = await params
  const resolved = await resolvePublicFormsAccess(request, Promise.resolve(values))
  if ("response" in resolved) return resolved.response
  const output = await publicFormsUseCase.preview(resolved.access, values.formId)
  return outputResponse(output)
}
