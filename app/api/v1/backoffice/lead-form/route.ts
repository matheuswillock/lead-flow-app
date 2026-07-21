import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeLeadQuickEntryUseCase } from "@/app/api/useCases/backofficeLeadQuickEntry/BackofficeLeadQuickEntryUseCase"
import { BackofficeLeadQuickEntryRequestSchema } from "@/app/api/useCases/backofficeLeadQuickEntry/DTO/requestBackofficeLeadQuickEntry"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function POST(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const parsed = BackofficeLeadQuickEntryRequestSchema.safeParse(body)
    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message)
      return NextResponse.json(new Output(false, [], messages, null), { status: 400 })
    }

    const output = await backofficeLeadQuickEntryUseCase.submit(parsed.data, result.access.profileId)
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeLeadFormRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
