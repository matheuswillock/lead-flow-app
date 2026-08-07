import { NextRequest, connection } from "next/server";
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { publicFormDraftSchema } from "@/lib/public-forms/validation"
import { Output } from "@/lib/output"
import { outputResponse, resolvePublicFormsAccess } from "../_utils"

type Params = Promise<{ teamId: string; formId: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  await connection();

  const values = await params
  const resolved = await resolvePublicFormsAccess(request, Promise.resolve(values))
  if ("response" in resolved) return resolved.response
  return outputResponse(await publicFormsUseCase.get(resolved.access, values.formId))
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const values = await params
  const resolved = await resolvePublicFormsAccess(request, Promise.resolve(values))
  if ("response" in resolved) return resolved.response
  const parsed = publicFormDraftSchema.safeParse(await request.json().catch(() => null))
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
  return outputResponse(
    await publicFormsUseCase.update(resolved.access, values.formId, parsed.data),
  )
}
