import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { backofficeTermsAcceptanceOutboxUseCase } from "@/app/api/useCases/backofficeTermsAcceptance/BackofficeTermsAcceptanceOutboxUseCase"

export async function GET(request: NextRequest) {
  console.info("[BackofficeTermsAcceptanceOutboxRoute][GET] iniciado")
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
  }
  const output = await backofficeTermsAcceptanceOutboxUseCase.dispatchPending(25)
  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}
