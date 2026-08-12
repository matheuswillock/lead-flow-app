import { NextResponse } from "next/server"
import { platformCheckoutUseCase } from "@/app/api/useCases/platformCheckout/PlatformCheckoutUseCase"

type PlatformPurchaseTypeInput =
  | "email_credits"
  | "feature_addon"
  | "radar_self_service"
  | "radar_managed"
  | "subscription_capacity"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      productSlug?: string
      purchaseType?: PlatformPurchaseTypeInput
      profileId?: string
      teamId?: string | null
      billingType?: "PIX" | "CREDIT_CARD"
      amount?: number
      quantity?: number | null
      description?: string | null
      metadata?: Record<string, unknown>
      asaasCustomerId?: string | null
    }

    const output = await platformCheckoutUseCase.createCheckout({
      productSlug: body.productSlug ?? "",
      purchaseType: body.purchaseType as PlatformPurchaseTypeInput,
      profileId: body.profileId ?? "",
      teamId: body.teamId,
      billingType: body.billingType as "PIX" | "CREDIT_CARD",
      amount: Number(body.amount),
      quantity: body.quantity,
      description: body.description,
      metadata: body.metadata,
      asaasCustomerId: body.asaasCustomerId,
    })

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[PlatformCheckoutRoute][POST]", error)
    return NextResponse.json(
      { isValid: false, errorMessages: ["Erro ao criar checkout genérico"] },
      { status: 500 }
    )
  }
}
