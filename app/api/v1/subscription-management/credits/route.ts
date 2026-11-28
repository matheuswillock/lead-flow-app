import { NextRequest, NextResponse } from "next/server";
import { subscriptionManagementUseCase } from "@/app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase";
import { failedOutputStatus } from "@/lib/payment-methods/route-guard";
import { requireSubscriptionManagementAccess } from "../requireSubscriptionManagementAccess";

export async function POST(request: NextRequest) {
  const accessDeniedResponse = await requireSubscriptionManagementAccess(request, "write");
  if (accessDeniedResponse) {
    return accessDeniedResponse;
  }

  const supabaseId = request.headers.get("x-supabase-user-id")!;

  const output = await subscriptionManagementUseCase.updateCredits(supabaseId, await request.json());
  const status = output.isValid
    ? 200
    : output.errorMessages[0] === "Apenas o master pode atualizar créditos"
      ? 403
      : failedOutputStatus(output);

  return NextResponse.json(output, { status });
}
