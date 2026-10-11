import { connection, NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { cardReauthorizationUseCase } from "@/app/api/useCases/asaasAccountMigration/cardReauthorizationFactory"
import { Output } from "@/lib/output"
import { getTrustedClientIp } from "@/lib/http/get-trusted-client-ip"

const cardSchema = z.object({
  card: z.object({
    holderName: z.string().trim().min(2).max(120),
    number: z.string().regex(/^\d{12,19}$/),
    expiryMonth: z.string().regex(/^\d{2}$/),
    expiryYear: z.string().regex(/^\d{4}$/),
    ccv: z.string().regex(/^\d{3,4}$/),
  }),
  cardholder: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().email().max(254),
    cpfCnpj: z.string().min(11).max(14),
    postalCode: z.string().min(8).max(9),
    addressNumber: z.string().min(1).max(20),
    addressComplement: z.string().max(120).nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
    mobilePhone: z.string().max(30).nullable().optional(),
  }),
})

function unauthorized() {
  return NextResponse.json(new Output(false, [], ["Não autenticado"], null), { status: 401 })
}

function invalidToken() {
  return NextResponse.json(new Output(false, [], ["Reautorização inválida ou expirada"], null), { status: 404 })
}

function errorStatus(reason: string | undefined): number {
  if (reason === "banned") return 403
  if (reason === "rate_limited") return 429
  if (reason === "already_processing") return 423
  if (reason === "invalid_or_expired" || reason === "expired") return 410
  return 409
}

export async function GET(request: NextRequest, routeContext: { params: Promise<{ token: string }> }) {
  await connection()
  const supabaseId = request.headers.get("x-supabase-user-id")
  if (!supabaseId) return unauthorized()
  const { token } = await routeContext.params
  const access = await cardReauthorizationUseCase.getContext(token, supabaseId)
  const reason = (access.result as { reason?: string } | null)?.reason
  if (reason === "banned" || reason === "expired") {
    return NextResponse.json(access, { status: errorStatus(reason) })
  }
  if (!access.isValid) return invalidToken()
  return NextResponse.json(
    new Output(true, [], [], {
      clientName: (access.result as { clientName: string }).clientName,
      status: (access.result as { status: string }).status,
      expiresAt: (access.result as { expiresAt: Date }).expiresAt,
    })
  )
}

export async function POST(request: NextRequest, routeContext: { params: Promise<{ token: string }> }) {
  await connection()
  const supabaseId = request.headers.get("x-supabase-user-id")
  if (!supabaseId) return unauthorized()
  const { token } = await routeContext.params
  const access = await cardReauthorizationUseCase.getContext(token, supabaseId)
  const accessReason = (access.result as { reason?: string } | null)?.reason
  if (accessReason === "banned" || accessReason === "expired") {
    return NextResponse.json(access, { status: errorStatus(accessReason) })
  }
  if (!access.isValid) return invalidToken()
  const remoteIp = getTrustedClientIp(request.headers)
  if (!remoteIp) return NextResponse.json(new Output(false, [], ["IP do cliente ausente"], null), { status: 400 })

  const parsed = cardSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(new Output(false, [], ["Dados do cartão inválidos"], null), { status: 400 })
  try {
    const result = await cardReauthorizationUseCase.submit({
      token,
      supabaseId,
      card: parsed.data.card,
      cardholder: parsed.data.cardholder,
      remoteIp,
    })
    const reason = (result.result as { reason?: string } | null)?.reason
    const status = result.isValid ? 200 : errorStatus(reason)
    const response = NextResponse.json(result, { status })
    if (status === 429) {
      const retryAt = (result.result as { retryAt?: Date | string } | null)?.retryAt
      const retryAfterSeconds = retryAt
        ? Math.max(1, Math.ceil((new Date(retryAt).getTime() - Date.now()) / 1000))
        : 86_400
      response.headers.set("Retry-After", String(retryAfterSeconds))
    }
    return response
  } catch (error) {
    return NextResponse.json(new Output(false, [], ["Não foi possível autorizar o cartão"], null), { status: 502 })
  }
}
