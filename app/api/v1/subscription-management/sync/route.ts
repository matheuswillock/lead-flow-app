import { NextRequest, NextResponse } from "next/server";
import { subscriptionManagementUseCase } from "@/app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase";
import { requireSubscriptionManagementAccess } from "../requireSubscriptionManagementAccess";

export async function POST(request: NextRequest) {
  const accessDeniedResponse = await requireSubscriptionManagementAccess(request, "write");
  if (accessDeniedResponse) {
    return accessDeniedResponse;
  }

  const supabaseId = request.headers.get("x-supabase-user-id")!;

  const output = await subscriptionManagementUseCase.syncSubscription(supabaseId);
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
}
