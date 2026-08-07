import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeAllUsersUseCase } from "@/app/api/useCases/backoffice/BackofficeAllUsersUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  await connection();

  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const { profileId } = await params
    const output = await backofficeAllUsersUseCase.getDetail(profileId)

    return NextResponse.json(output, {
      status: output.isValid ? 200 : output.errorMessages.includes("Usuário não encontrado") ? 404 : 400,
    })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeAllUsersByIdRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
