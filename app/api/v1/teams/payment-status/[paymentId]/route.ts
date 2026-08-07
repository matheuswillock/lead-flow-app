import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { asaasApi, asaasFetch } from "@/lib/asaas";

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

    const payment = await asaasFetch(`${asaasApi.payments}/${paymentId}`, {
      method: "GET",
    });

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

