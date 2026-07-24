import { type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioEmailUseCase } from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"
import {
  resolveStudioEmailActor,
  studioEmailError,
  studioEmailJson,
  type StudioEmailRouteParams,
} from "@/app/api/v1/backoffice/utils/studioEmailRoute"

const schema = z.object({ domainName: z.string().min(1) })
type RouteContext = { params: Promise<StudioEmailRouteParams> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioEmailActor(request, params)
    if (resolved.error) return resolved.error
    const body = await request.json().catch(() => null)
    const validation = schema.safeParse(body)
    if (!validation.success) {
      return studioEmailJson(new Output(false, [], ["domainName é obrigatório"], null))
    }
    const output = await backofficeStudioEmailUseCase.connectDomain(resolved.actor, validation.data.domainName)
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailDomainRoute][POST]", error)
    return studioEmailError(["Erro interno"])
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioEmailActor(request, params)
    if (resolved.error) return resolved.error
    const output = await backofficeStudioEmailUseCase.disconnectDomain(resolved.actor)
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailDomainRoute][DELETE]", error)
    return studioEmailError(["Erro interno"])
  }
}
