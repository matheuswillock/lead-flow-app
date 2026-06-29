import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { BackofficePaymentUseCase } from "@/app/api/useCases/backoffice/BackofficePaymentUseCase"
import { BackofficePaymentRepository } from "@/app/api/infra/data/repositories/backoffice/PaymentRepository/BackofficePaymentRepository"
import { BackofficeClientRepository } from "@/app/api/infra/data/repositories/backoffice/ClientRepository/BackofficeClientRepository"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { id } = await params
    const useCase = new BackofficePaymentUseCase(
      new BackofficePaymentRepository(),
      new BackofficeClientRepository()
    )
    const output = await useCase.getPaymentById(id)
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficePaymentByIdRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
