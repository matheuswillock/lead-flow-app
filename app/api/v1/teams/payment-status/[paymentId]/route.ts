import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { getPaymentByAccountWithFallback } from "@/lib/billing/get-payment-by-account";

/**
 * GET /api/v1/teams/payment-status/[paymentId]
 * Verifica o status de um pagamento relacionado a criacao de time.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  await connection();

  try {
    const { paymentId } = await params;

    if (!paymentId) {
      return NextResponse.json(
        new Output(false, [], ["ID do pagamento é obrigatório"], null),
        { status: 400 }
      );
    }

    // C24 de [[20 — Assinaturas — Backend]] E5: fallback de conta.
    const lookup = await getPaymentByAccountWithFallback(paymentId);

    if (!lookup.found) {
      return NextResponse.json(
        new Output(false, [], ["Pagamento não encontrado"], null),
        { status: 404 }
      );
    }

    const payment = lookup.payment as { status?: string; externalReference?: string };

    return NextResponse.json(
      new Output(true, [], [], {
        paymentId,
        status: payment.status,
        paymentStatus: payment.status,
        externalReference: payment.externalReference,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[GET /api/v1/teams/payment-status] Erro:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro ao verificar pagamento"], null),
      { status: 500 }
    );
  }
}

