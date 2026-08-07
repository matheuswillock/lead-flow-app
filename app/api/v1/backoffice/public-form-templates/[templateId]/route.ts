import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from "zod"
import { Output } from "@/lib/output"
import type { PublicFormDraftInput } from "@/lib/public-forms/types"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficePublicFormTemplateUseCase } from "@/app/api/useCases/backofficePublicFormTemplates/BackofficePublicFormTemplateUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

type RouteContext = { params: Promise<{ templateId: string }> }

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  formKind: z.string().trim().optional(),
  sortOrder: z.number().int().optional(),
  draft: z.custom<PublicFormDraftInput>().optional(),
})

export async function GET(_request: NextRequest, { params }: RouteContext) {
  await connection();

  try {
    const access = await getBackofficeAccess(_request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })
    const denied = requireManagerAccess(access.access)
    if (denied) return denied

    const { templateId } = await params
    const output = await backofficePublicFormTemplateUseCase.getById(templateId)
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficePublicFormTemplateRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })
    const denied = requireManagerAccess(access.access)
    if (denied) return denied

    const parsed = updateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const { templateId } = await params
    const output = await backofficePublicFormTemplateUseCase.update(templateId, parsed.data)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficePublicFormTemplateRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
