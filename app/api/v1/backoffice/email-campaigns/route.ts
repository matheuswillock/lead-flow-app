import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficeEmailCampaignUseCase } from "@/app/api/useCases/backofficeEmailCampaign/BackofficeEmailCampaignUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

function optionalString(data: Record<string, unknown>, key: string): string | null | undefined {
  const value = data[key]
  if (value === undefined) return undefined
  if (value === null) return null
  return typeof value === "string" ? value : undefined
}

export async function GET(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const output = await backofficeEmailCampaignUseCase.list()
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeEmailCampaignsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireMasterAccess(result.access)
    if (denied) return denied

    if (!result.access.backofficeUserId) {
      return NextResponse.json(
        new Output(false, [], ["Usuário backoffice sem vínculo ativo"], null),
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }
    const data = body as Record<string, unknown>

    const output = await backofficeEmailCampaignUseCase.create(
      {
        name: typeof data.name === "string" ? data.name : "",
        contactListId: typeof data.contactListId === "string" ? data.contactListId : undefined,
        scheduledAt: typeof data.scheduledAt === "string" ? data.scheduledAt : undefined,
        resendTemplateId: optionalString(data, "resendTemplateId"),
        resendTemplateName: optionalString(data, "resendTemplateName"),
        fromName: optionalString(data, "fromName"),
        fromEmail: optionalString(data, "fromEmail"),
        replyTo: optionalString(data, "replyTo"),
      },
      result.access.backofficeUserId
    )
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeEmailCampaignsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
