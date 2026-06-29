import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficeWhatsAppInstanceUseCase } from "@/app/api/useCases/backofficeWhatsApp/BackofficeWhatsAppInstanceUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const updateSchema = z.object({
  usageLimitMonthly: z.number().int().min(0).optional(),
  billingEnabled: z.boolean().optional(),
  hostBaseUrl: z.string().trim().optional().nullable(),
})

type RouteContext = { params: Promise<{ configId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })

    const { configId } = await context.params
    const output = await backofficeWhatsAppInstanceUseCase.getInstance(configId)
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeWhatsAppInstanceRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })
    const denied = requireMasterAccess(access.access)
    if (denied) return denied

    const parsed = updateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const { configId } = await context.params
    const output = await backofficeWhatsAppInstanceUseCase.updateInstance(configId, {
      ...parsed.data,
      updatedByProfileId: access.access.profileId,
    })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeWhatsAppInstanceRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
