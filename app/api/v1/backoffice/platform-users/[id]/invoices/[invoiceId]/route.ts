import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { BackofficePlatformUsersUseCase } from "@/app/api/useCases/backoffice/BackofficePlatformUsersUseCase"
import { BackofficePlatformUsersRepository } from "@/app/api/infra/data/repositories/backoffice/PlatformUsersRepository/BackofficePlatformUsersRepository"

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

export async function POST(
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

    const body = await request.json()
    if (body?.action !== "notify-status-email") {
      return NextResponse.json(
        new Output(false, [], ["Ação inválida"], null),
        { status: 400 }
      )
    }

    const { id, invoiceId } = await params
    const useCase = new BackofficePlatformUsersUseCase(new BackofficePlatformUsersRepository())
    const output = await useCase.notifyMasterUserInvoiceStatusEmail(id, invoiceId)

    if (output.isValid) {
      return NextResponse.json(output, { status: 200 })
    }

    const notFound = output.errorMessages.some((message) =>
      message.toLowerCase().includes("não encontrada") ||
      message.toLowerCase().includes("não encontrado")
    )

    return NextResponse.json(output, { status: notFound ? 404 : 400 })
  } catch (error) {
    console.error("[BackofficePlatformUserInvoiceByIdRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
