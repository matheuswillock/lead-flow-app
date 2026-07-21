import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeAccountUseCase } from "@/app/api/useCases/backofficeAccount/BackofficeAccountUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const output = await backofficeAccountUseCase.getAccount(accessResult.access.profileId)
    if (!output.isValid || !output.result || typeof output.result !== "object") {
      return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
    }

    const timezone = (output.result as { timezone?: string }).timezone
    return NextResponse.json(new Output(true, [], [], { timezone }), { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeAccountTimezoneRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const body = await request.json().catch(() => ({}))
    const output = await backofficeAccountUseCase.updateTimezone(
      accessResult.access.profileId,
      body?.timezone
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeAccountTimezoneRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
