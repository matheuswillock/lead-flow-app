import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { backofficeAdhesionUseCase } from "@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

interface PublicAdhesionCreditCardPayload {
  holderName: string
  number: string
  expiryMonth: string
  expiryYear: string
  ccv: string
}

function getRemoteIp(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = request.headers.get("x-real-ip")?.trim()
  return forwardedFor || realIp || undefined
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const { token } = await params
    const data = body as Record<string, unknown>

    const billingType = data.billingType === "PIX" || data.billingType === "CREDIT_CARD"
      ? data.billingType
      : null

    if (!billingType) {
      console.info("[PublicAdhesionCheckoutRoute][POST] billingType rejeitado:", data.billingType)
      return NextResponse.json(
        new Output(false, [], ["Forma de pagamento inválida. Use PIX ou CREDIT_CARD."], null),
        { status: 400 }
      )
    }

    const creditCard =
      data.creditCard && typeof data.creditCard === "object"
        ? (data.creditCard as PublicAdhesionCreditCardPayload)
        : undefined

    console.info("[PublicAdhesionCheckoutRoute][POST] token:", token, "billingType:", billingType)

    const output = await backofficeAdhesionUseCase.createCheckout(token, {
      fullName: typeof data.fullName === "string" ? data.fullName : "",
      email: typeof data.email === "string" ? data.email : "",
      phone: typeof data.phone === "string" ? data.phone : "",
      cpfCnpj: typeof data.cpfCnpj === "string" ? data.cpfCnpj : "",
      postalCode: typeof data.postalCode === "string" ? data.postalCode : "",
      address: typeof data.address === "string" ? data.address : "",
      addressNumber: typeof data.addressNumber === "string" ? data.addressNumber : "",
      neighborhood: typeof data.neighborhood === "string" ? data.neighborhood : "",
      complement:
        typeof data.complement === "string" || data.complement === null
          ? data.complement
          : undefined,
      city: typeof data.city === "string" ? data.city : "",
      state: typeof data.state === "string" ? data.state : "",
      billingType,
      installments:
        typeof data.installments === "number" && Number.isFinite(data.installments)
          ? Math.trunc(data.installments)
          : undefined,
      creditCard,
      remoteIp: getRemoteIp(request),
    })

    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[PublicAdhesionCheckoutRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
