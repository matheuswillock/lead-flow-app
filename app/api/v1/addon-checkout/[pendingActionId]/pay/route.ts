import { NextRequest, NextResponse } from "next/server";
import { addOnCheckoutUseCase } from "@/app/api/useCases/addOnCheckout/AddOnCheckoutUseCase";
import { failedOutputStatus } from "@/lib/payment-methods/route-guard";
import { Output } from "@/lib/output";
import { hasTermsAcceptance, TERMS_ACCEPTANCE_REQUIRED_MESSAGE } from "@/lib/legal/terms-acceptance";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pendingActionId: string }> }
) {
  try {
    const { pendingActionId } = await params;
    const body = await request.json();

    if (!hasTermsAcceptance(body.termsAccepted)) {
      return NextResponse.json(new Output(false, [], [TERMS_ACCEPTANCE_REQUIRED_MESSAGE], null), { status: 400 });
    }

    const remoteIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "0.0.0.0";

    const result = await addOnCheckoutUseCase.createPayment(pendingActionId, {
      termsAccepted: true,
      billingType: body.billingType,
      fullName: body.fullName ?? "",
      email: body.email ?? "",
      phone: body.phone ?? "",
      cpfCnpj: body.cpfCnpj ?? "",
      postalCode: body.postalCode ?? "",
      address: body.address ?? "",
      addressNumber: body.addressNumber ?? "",
      neighborhood: body.neighborhood ?? "",
      complement: body.complement,
      city: body.city,
      state: body.state,
      installments: body.installments,
      cardToken: body.cardToken,
      remoteIp,
    });

    return NextResponse.json(result, {
      status: result.isValid ? 201 : failedOutputStatus(result),
    });
  } catch (error: any) {
    console.error("[POST /api/v1/addon-checkout/[id]/pay][POST]", error);
    return NextResponse.json(
      {
        isValid: false,
        successMessages: [],
        errorMessages: [error.message || "Erro ao criar cobrança"],
        result: null,
      },
      { status: 500 }
    );
  }
}
