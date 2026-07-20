import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { BackofficePlatformUsersUseCase } from "@/app/api/useCases/backoffice/BackofficePlatformUsersUseCase"
import { BackofficePlatformUsersRepository } from "@/app/api/infra/data/repositories/backoffice/PlatformUsersRepository/BackofficePlatformUsersRepository"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

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
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficePlatformUserInvoiceByIdRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function PATCH(
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
    const value = typeof body?.value === "number" ? body.value : Number(body?.value)
    const dueDate = typeof body?.dueDate === "string" ? body.dueDate.trim() : ""

    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json(
        new Output(false, [], ["Informe um valor válido maior que zero"], null),
        { status: 400 }
      )
    }

    if (!dueDate) {
      return NextResponse.json(
        new Output(false, [], ["Informe a data de vencimento"], null),
        { status: 400 }
      )
    }

    const { id, invoiceId } = await params
    const useCase = new BackofficePlatformUsersUseCase(new BackofficePlatformUsersRepository())
    const output = await useCase.updateMasterUserInvoice(id, invoiceId, { value, dueDate })

    if (output.isValid) {
      return NextResponse.json(output, { status: 200 })
    }

    const notFound = output.errorMessages.some((message) =>
      message.toLowerCase().includes("não encontrada") ||
      message.toLowerCase().includes("não encontrado")
    )

    return NextResponse.json(output, { status: notFound ? 404 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficePlatformUserInvoiceByIdRoute][PATCH]", error)
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
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficePlatformUserInvoiceByIdRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
