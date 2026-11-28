import { NextRequest, NextResponse, connection } from "next/server";
import { subscriptionManagementUseCase } from '@/app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase';
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import { requireSubscriptionManagementAccess } from "../requireSubscriptionManagementAccess";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const accessDeniedResponse = await requireSubscriptionManagementAccess(request, "read");
    if (accessDeniedResponse) {
      return accessDeniedResponse;
    }

    const authenticatedSupabaseId = request.headers.get('x-supabase-user-id')!;

    const { searchParams } = new URL(request.url);
    const supabaseIdParam = searchParams.get('supabaseId');

    if (supabaseIdParam && supabaseIdParam !== authenticatedSupabaseId) {
      const forbiddenResult = {
        isValid: false,
        successMessages: [],
        errorMessages: ['Acesso negado para consultar faturas de outro usuário'],
        result: null
      };
      return NextResponse.json(forbiddenResult, { status: 403 });
    }

    const supabaseId = authenticatedSupabaseId;

    if (!supabaseId) {
      const errorResult = {
        isValid: false,
        successMessages: [],
        errorMessages: ['ID do usuário é obrigatório'],
        result: null
      };
      return NextResponse.json(errorResult, { status: 400 });
    }

    const result = await subscriptionManagementUseCase.getInvoices(supabaseId);
    const statusCode = result.isValid ? 200 : 400;

    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error('Erro inesperado na route:', error);

    const errorResult = {
      isValid: false,
      successMessages: [],
      errorMessages: ['Erro inesperado no servidor'],
      result: null
    };

    return NextResponse.json(errorResult, { status: 500 });
  }
}
