import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import {
  confirmTeamPaymentUseCase,
  type ConfirmTeamPaymentFailureReason,
} from "@/app/api/useCases/pendingActions/ConfirmTeamPaymentUseCase";

const STATUS_BY_FAILURE_REASON: Record<ConfirmTeamPaymentFailureReason, number> = {
  profile_not_found: 404,
  forbidden: 403,
  payment_not_confirmed: 400,
  action_not_found: 404,
  action_not_owned: 403,
  action_canceled: 400,
};

/**
 * POST /api/v1/teams/confirm-payment
 * Confirma o pagamento e aplica a pending action create_team.
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null),
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const paymentId = body?.paymentId as string | undefined;

    if (!paymentId) {
      return NextResponse.json(
        new Output(false, [], ["ID do pagamento é obrigatório"], null),
        { status: 400 }
      );
    }

    const result = await confirmTeamPaymentUseCase.confirmTeamPayment({ supabaseId, paymentId });

    if (!result.isValid) {
      const reason = (result.result as { reason?: ConfirmTeamPaymentFailureReason } | null)?.reason;
      const status = reason ? STATUS_BY_FAILURE_REASON[reason] : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/v1/teams/confirm-payment] Erro:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro interno do servidor"], null),
      { status: 500 }
    );
  }
}
