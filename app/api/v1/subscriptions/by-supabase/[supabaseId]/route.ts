import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { getSubscriptionBySupabaseIdUseCase } from "@/app/api/useCases/subscriptions/GetSubscriptionBySupabaseIdUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import { requireActiveAccountAccess } from "@/app/api/v1/utils/requireActiveAccountAccess";

/**
 * GET /api/v1/subscriptions/by-supabase/[supabaseId]
 * Consulta assinatura do usuário no Asaas a partir do supabaseId.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  await connection();

  try {
    const { supabaseId } = await params;
    const authenticatedSupabaseId = request.headers.get("x-supabase-user-id");
    if (!authenticatedSupabaseId) {
      return NextResponse.json(new Output(false, [], ["Não autenticado"], null), { status: 401 });
    }

    if (supabaseId !== authenticatedSupabaseId) {
      return NextResponse.json(new Output(false, [], ["Acesso negado"], null), { status: 403 });
    }

    const accessDeniedResponse = await requireActiveAccountAccess(authenticatedSupabaseId);
    if (accessDeniedResponse) {
      return accessDeniedResponse;
    }

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
    rethrowIfPrerenderInterrupted(error);
    console.error("❌ [SubscriptionBySupabaseRoute][GET] Erro inesperado:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao consultar assinatura"], null),
      { status: 500 }
    );
  }
}
