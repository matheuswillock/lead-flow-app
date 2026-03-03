import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getSubscriptionBySupabaseIdUseCase } from "@/app/api/useCases/subscriptions/GetSubscriptionBySupabaseIdUseCase";

/**
 * GET /api/v1/subscriptions/by-supabase/[supabaseId]
 * Consulta assinatura do usuário no Asaas a partir do supabaseId.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const { supabaseId } = await params;
    const output = await getSubscriptionBySupabaseIdUseCase.execute(supabaseId);

    if (output.isValid) {
      return NextResponse.json(output, { status: 200 });
    }

    if (output.errorMessages.includes("Supabase ID é obrigatório")) {
      return NextResponse.json(output, { status: 400 });
    }

    if (output.errorMessages.includes("Usuário não encontrado")) {
      return NextResponse.json(output, { status: 404 });
    }

    if (output.errorMessages.includes("Falha ao consultar assinatura no Asaas")) {
      return NextResponse.json(output, { status: 502 });
    }

    return NextResponse.json(output, { status: 500 });
  } catch (error) {
    console.error("❌ [SubscriptionBySupabaseRoute][GET] Erro inesperado:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao consultar assinatura"], null),
      { status: 500 }
    );
  }
}
