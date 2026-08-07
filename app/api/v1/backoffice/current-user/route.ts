import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeAccountUseCase } from "@/app/api/useCases/backofficeAccount/BackofficeAccountUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(request: NextRequest) {
  await connection();

  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const accountOutput = await backofficeAccountUseCase.getAccount(result.access.profileId)
    if (!accountOutput.isValid) {
      return NextResponse.json(accountOutput, { status: 404 })
    }

    const account = accountOutput.result as Record<string, unknown>
    const output = new Output(true, [], [], {
      ...account,
      profileId: result.access.profileId,
      backofficeUserId: result.access.backofficeUserId,
      fullAccess: result.access.fullAccess,
      isOperator: result.access.isOperator,
    })
    return NextResponse.json(output, { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeCurrentUserRoute][GET]", error)
    const output = new Output(false, [], ["Erro interno"], null)
    return NextResponse.json(output, { status: 500 })
  }
}

