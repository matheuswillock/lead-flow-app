import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeSubscriptionChangeOrderUseCase } from "@/app/api/useCases/backoffice/BackofficeSubscriptionChangeOrderUseCase"
import { BILLING_RATE_LIMIT_DEFAULTS, consumeBillingRateLimit } from "@/lib/billing/billing-rate-limit"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const VALID_CYCLES = new Set(["monthly", "quarterly", "quadrimester", "semiannual", "annual"])

/**
 * POST /api/v1/backoffice/subscription-change-orders — E6/G1.
 * Mutação sensível de cobrança: `requireManagerAccess` por construção
 * (lição S1), independente de haver preço avulso ou não.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }
    const denied = requireManagerAccess(access.access)
    if (denied) return denied

    const body = await request.json().catch(() => ({}))
    const { masterProfileId, targetProductId, targetCycle } = body

    if (typeof masterProfileId !== "string" || !masterProfileId) {
      return NextResponse.json(
        new Output(false, [], ["masterProfileId é obrigatório"], null),
        { status: 400 }
      )
    }
    if (typeof targetProductId !== "string" || !targetProductId) {
      return NextResponse.json(
        new Output(false, [], ["targetProductId é obrigatório"], null),
        { status: 400 }
      )
    }
    if (typeof targetCycle !== "string" || !VALID_CYCLES.has(targetCycle)) {
      return NextResponse.json(new Output(false, [], ["targetCycle inválido"], null), {
        status: 400,
      })
    }

    const overrideAmount =
      typeof body.overrideAmount === "number" && Number.isFinite(body.overrideAmount)
        ? body.overrideAmount
        : null

    // S2/DA2: rate limit do E2 nas rotas de preço avulso — só consultado
    // quando há preço avulso na operação.
    if (overrideAmount !== null) {
      const rateLimitResult = await consumeBillingRateLimit(
        `subscription-change-order-override:${access.access.backofficeUserId ?? access.access.profileId}`,
        BILLING_RATE_LIMIT_DEFAULTS.backofficePricing
      )
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          new Output(false, [], ["Muitas tentativas. Tente novamente em instantes."], null),
          { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }
        )
      }
    }

    const output = await backofficeSubscriptionChangeOrderUseCase.create({
      masterProfileId,
      targetProductId,
      targetCycle: targetCycle as
        | "monthly"
        | "quarterly"
        | "quadrimester"
        | "semiannual"
        | "annual",
      overrideAmount,
      actorProfileId: access.access.profileId,
      backofficeUserId: access.access.backofficeUserId,
    })

    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeSubscriptionChangeOrdersRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
