import { NextResponse, type NextRequest } from "next/server"
import { paymentProviderConfigUseCase } from "@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition"
import { authorizeRead } from "../providerConfigRoute"

export async function GET(request: NextRequest) {
  const guard = await authorizeRead(request)
  if (guard.response) return guard.response
  return NextResponse.json(paymentProviderConfigUseCase.listAdapters(), { status: 200 })
}
