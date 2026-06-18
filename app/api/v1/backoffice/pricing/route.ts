import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficeProductUseCase } from "@/app/api/useCases/backofficeProduct/BackofficeProductUseCase"

export async function GET(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const output = await backofficeProductUseCase.list()
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficePricingRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireMasterAccess(result.access)
    if (denied) return denied

    const body = await request.json()
    const output = await backofficeProductUseCase.create(body)
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    console.error("[BackofficePricingRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
