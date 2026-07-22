import { NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficePublicLeadFormBootstrapUseCase } from "@/app/api/useCases/backofficePublicLeadForm/BackofficePublicLeadFormBootstrapUseCase"

export async function GET() {
  try {
    const output = await backofficePublicLeadFormBootstrapUseCase.listClosers()
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficePublicLeadFormBootstrapRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
