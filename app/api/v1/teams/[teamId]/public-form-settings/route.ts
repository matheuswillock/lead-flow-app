import { NextRequest } from "next/server"
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { publicFormSettingsSchema } from "@/lib/public-forms/validation"
import { Output } from "@/lib/output"
import { outputResponse, resolvePublicFormsAccess } from "../public-forms/_utils"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const resolved = await resolvePublicFormsAccess(request, params)
  if ("response" in resolved) return resolved.response
  return outputResponse(await publicFormsUseCase.getSettings(resolved.access))
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const resolved = await resolvePublicFormsAccess(request, params)
  if ("response" in resolved) return resolved.response
  const parsed = publicFormSettingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return outputResponse(
      new Output(
        false,
        [],
        parsed.error.issues.map((issue) => issue.message),
        null,
      ),
    )
  }
  return outputResponse(await publicFormsUseCase.updateSettings(resolved.access, parsed.data))
}
