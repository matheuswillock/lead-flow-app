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

  const output = await subscriptionManagementUseCase.syncSubscription(supabaseId);
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
}
