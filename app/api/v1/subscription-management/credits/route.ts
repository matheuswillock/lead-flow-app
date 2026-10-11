import { NextRequest, NextResponse } from "next/server";
import { subscriptionManagementUseCase } from "@/app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase";
import { Output } from "@/lib/output";
import { requireActiveAccountAccess } from "@/app/api/v1/utils/requireActiveAccountAccess";

export async function POST(request: NextRequest) {
  const supabaseId = request.headers.get("x-supabase-user-id");
  if (!supabaseId) {
    const output = new Output(false, [], ["Não autenticado"], null);
    return NextResponse.json(output, { status: 401 });
  }

  const accessDeniedResponse = await requireActiveAccountAccess(supabaseId);
  if (accessDeniedResponse) {
    return accessDeniedResponse;
  }

  const output = await subscriptionManagementUseCase.updateCredits(supabaseId, await request.json());
  const status = output.isValid ? 200 : output.errorMessages[0] === "Apenas o master pode atualizar créditos" ? 403 : 400;

  return NextResponse.json(output, { status });
}
