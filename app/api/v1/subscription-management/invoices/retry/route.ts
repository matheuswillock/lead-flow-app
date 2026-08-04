import { NextRequest, NextResponse } from "next/server";
import { subscriptionManagementUseCase } from "@/app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

/**
 * POST /api/v1/subscription-management/invoices/retry
 * Retenta cobrança de uma fatura no Asaas (Estágio 2 / C2b).
 */
export async function POST(request: NextRequest) {
  try {
    const authenticatedSupabaseId = request.headers.get("x-supabase-user-id");
    if (!authenticatedSupabaseId) {
      return NextResponse.json(
        {
          isValid: false,
          successMessages: [],
          errorMessages: ["Não autenticado"],
          result: null,
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const invoiceId = typeof body?.invoiceId === "string" ? body.invoiceId : "";
    const supabaseIdParam =
      typeof body?.supabaseId === "string" ? body.supabaseId : authenticatedSupabaseId;

    if (supabaseIdParam !== authenticatedSupabaseId) {
      return NextResponse.json(
        {
          isValid: false,
          successMessages: [],
          errorMessages: ["Acesso negado para retentar fatura de outro usuário"],
          result: null,
        },
        { status: 403 }
      );
    }

    if (!invoiceId) {
      return NextResponse.json(
        {
          isValid: false,
          successMessages: [],
          errorMessages: ["ID da fatura é obrigatório"],
          result: null,
        },
        { status: 400 }
      );
    }

    console.info("[SubscriptionManagementInvoicesRetryRoute][POST]", {
      supabaseId: authenticatedSupabaseId,
      invoiceId,
    });

    const result = await subscriptionManagementUseCase.retryPayment(
      authenticatedSupabaseId,
      invoiceId
    );

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[SubscriptionManagementInvoicesRetryRoute][POST] Erro:", error);
    return NextResponse.json(
      {
        isValid: false,
        successMessages: [],
        errorMessages: ["Erro interno ao retentar pagamento"],
        result: null,
      },
      { status: 500 }
    );
  }
}
