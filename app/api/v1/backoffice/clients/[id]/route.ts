import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { AsaasCustomerService } from "@/app/api/services/AsaasCustomer/AsaasCustomerService"
import { BackofficeClientUseCase } from "@/app/api/useCases/backoffice/BackofficeClientUseCase"
import { BackofficeClientRepository } from "@/app/api/infra/data/repositories/backoffice/ClientRepository/BackofficeClientRepository"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection();

  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { id } = await params
    const useCase = new BackofficeClientUseCase(
      new BackofficeClientRepository(),
      new AsaasCustomerService()
    )
    const output = await useCase.getClientById(id)
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeClientByIdRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
