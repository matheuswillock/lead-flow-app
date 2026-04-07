import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { BackofficePlatformUsersRepository } from "@/app/api/infra/data/repositories/backoffice/BackofficePlatformUsersRepository"
import { BackofficePlatformUsersUseCase } from "@/app/api/useCases/backoffice/BackofficePlatformUsersUseCase"

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; invoiceId: string }>
  }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { id, invoiceId } = await params
    const useCase = new BackofficePlatformUsersUseCase(new BackofficePlatformUsersRepository())
    const output = await useCase.getMasterUserInvoiceById(id, invoiceId)

    return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
  } catch (error) {
    console.error("[BackofficePlatformUserInvoiceByIdRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
