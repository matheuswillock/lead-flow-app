import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { BackofficePaymentUseCase } from "@/app/api/useCases/backoffice/BackofficePaymentUseCase"
import { BackofficePaymentRepository } from "@/app/api/infra/data/repositories/backoffice/PaymentRepository/BackofficePaymentRepository"
import { BackofficeClientRepository } from "@/app/api/infra/data/repositories/backoffice/ClientRepository/BackofficeClientRepository"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

function makeUseCase() {
  return new BackofficePaymentUseCase(
    new BackofficePaymentRepository(),
    new BackofficeClientRepository()
  )
}

export async function GET(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId") ?? undefined

    const useCase = makeUseCase()
    const output = await useCase.listPayments(clientId)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficePaymentsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const body = await request.json()
    const useCase = makeUseCase()
    const output = await useCase.createPayment(body, result.access.profileId)
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficePaymentsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
