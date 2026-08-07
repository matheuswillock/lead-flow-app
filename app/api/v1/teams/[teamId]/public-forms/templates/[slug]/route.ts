import { type NextRequest, connection } from "next/server";
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { outputResponse, resolvePublicFormsAccess } from "../../_utils"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; slug: string }> },
) {
  await connection();

  const { slug, ...teamParams } = await params
  const resolved = await resolvePublicFormsAccess(request, Promise.resolve(teamParams))
  if ("response" in resolved) return resolved.response
  return outputResponse(await publicFormsUseCase.getTemplate(resolved.access, slug))
}
