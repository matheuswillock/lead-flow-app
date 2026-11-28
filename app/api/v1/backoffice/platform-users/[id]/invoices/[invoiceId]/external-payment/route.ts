import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficePlatformUsersUseCase } from "@/app/api/useCases/backoffice/BackofficePlatformUsersUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

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

    const denied = requireManagerAccess(result.access)
    if (denied) return denied

    const body = await request.json().catch(() => null)
    const reference = typeof body?.reference === "string" ? body.reference.trim() : ""
    const proofUrl = typeof body?.proofUrl === "string" ? body.proofUrl.trim() || null : null
    const paidAt = typeof body?.paidAt === "string" ? body.paidAt.trim() || null : null

    if (!reference) {
      return NextResponse.json(
        new Output(false, [], ["Informe a referência do pagamento externo"], null),
        { status: 400 }
      )
    }

    const { id, invoiceId } = await params
    const actor = {
      profileId: result.access.profileId,
      backofficeUserId: result.access.backofficeUserId,
      backofficeEmail: result.access.backofficeEmail,
    }

    const output = await backofficePlatformUsersUseCase.markMasterUserInvoicePaidExternally(
      id,
      invoiceId,
      { reference, proofUrl, paidAt },
      actor
    )

    if (output.isValid) {
      return NextResponse.json(output, { status: 200 })
    }

    const notFound = output.errorMessages.some(
      (message) =>
        message.toLowerCase().includes("não encontrada") ||
        message.toLowerCase().includes("não encontrado")
    )

    return NextResponse.json(output, { status: notFound ? 404 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficePlatformUserInvoiceExternalPaymentRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
