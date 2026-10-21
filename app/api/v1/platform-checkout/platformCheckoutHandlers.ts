import { NextResponse, type NextRequest } from "next/server"
import type { EmailCreditPlan } from "@prisma/client"
import { Output } from "@/lib/output"
import { isManagerLikeRole } from "@/lib/roles"
import { parseEmailCreditsPlanFromProductSlug } from "@/lib/email/email-credit-plans"
import type { AuthenticatedSupabaseIdResult } from "@/app/api/v1/utils/getAuthenticatedSupabaseId"
import type { TeamAccess, TeamAccessResult } from "@/app/api/v1/utils/teamAccess"

type BillingType = "PIX" | "CREDIT_CARD"

export type PlatformCheckoutHandlerDeps = {
  getTeamAccess(request: NextRequest): Promise<TeamAccessResult>
  getAuthenticatedSupabaseId(request: NextRequest): Promise<AuthenticatedSupabaseIdResult>
  findProfileIdBySupabaseId(supabaseId: string): Promise<string | null>
  subscribeEmailCredits(plan: EmailCreditPlan, access: TeamAccess, billingType: BillingType): Promise<Output>
  getCheckoutDetailsForOwner(checkoutId: string, ownerProfileId: string): Promise<Output>
}

function isBillingType(value: unknown): value is BillingType {
  return value === "PIX" || value === "CREDIT_CARD"
}

function reject(message: string, status: number) {
  return NextResponse.json(new Output(false, [], [message], null), { status })
}

// Dono, time e preço vêm sempre da sessão e do catálogo do servidor; o body
// só escolhe produto e forma de pagamento.
export async function handleCreatePlatformCheckout(request: NextRequest, deps: PlatformCheckoutHandlerDeps) {
  const teamAccess = await deps.getTeamAccess(request)
  if (teamAccess.error) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status })
  }
  if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
    return reject("Apenas managers podem iniciar esta compra", 403)
  }

  const body = (await request.json().catch(() => null)) as {
    productSlug?: unknown
    billingType?: unknown
  } | null

  const plan = parseEmailCreditsPlanFromProductSlug(
    typeof body?.productSlug === "string" ? body.productSlug : null,
  )
  if (!plan) {
    return reject("Produto indisponível para compra direta", 400)
  }
  if (!isBillingType(body?.billingType)) {
    return reject("billingType inválido", 400)
  }

  const output = await deps.subscribeEmailCredits(plan, teamAccess.access, body.billingType)
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
}

export async function handleGetPlatformCheckout(
  request: NextRequest,
  checkoutId: string,
  deps: PlatformCheckoutHandlerDeps,
) {
  const auth = await deps.getAuthenticatedSupabaseId(request)
  if (auth.error) {
    return NextResponse.json(auth.error, { status: auth.status })
  }

  const profileId = await deps.findProfileIdBySupabaseId(auth.supabaseId)
  if (!profileId) {
    return reject("Checkout não encontrado", 404)
  }

  const output = await deps.getCheckoutDetailsForOwner(checkoutId, profileId)
  return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
}
