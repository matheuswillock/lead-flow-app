import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import {
  getTeamAccess,
  hasDelegatedTeamManagementAccess,
} from "@/app/api/v1/utils/teamAccess";
import { createTeamCheckoutUseCase } from "@/app/api/useCases/teamCheckout/CreateTeamCheckoutUseCase";
import { getClientIpFromRequest } from "@/lib/http/get-client-ip";
import { BILLING_RATE_LIMIT_DEFAULTS, consumeBillingRateLimit } from "@/lib/billing/billing-rate-limit";

const formatTeamName = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const normalizeBillingType = (value: unknown): "PIX" | "CREDIT_CARD" | null => {
  if (value === "PIX" || value === "CREDIT_CARD") return value
  return null
}

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
    const teamName = formatTeamName(body?.name);
    const billingType = normalizeBillingType(body?.billingType) ?? "PIX"

    if (!teamName || teamName.length < 2) {
      return NextResponse.json(
        new Output(false, [], ["Nome do time deve ter pelo menos 2 caracteres"], null),
        { status: 400 }
      );
    }

    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { profileId, managerId, teamMember } = teamAccess.access;
    if (!hasDelegatedTeamManagementAccess(teamAccess.access)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas o master ou um manager delegado pode criar times"], null),
        { status: 403 }
      );
    }

    // S2/DA2: checkout self-service — por profileId + IP, evita fábrica de
    // cobranças/customers (T-50.5).
    const rateLimitKey = `${profileId}:${getClientIpFromRequest(request)}`;
    const rateLimitResult = await consumeBillingRateLimit(
      rateLimitKey,
      BILLING_RATE_LIMIT_DEFAULTS.checkoutCreate
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        new Output(false, [], ["Muitas tentativas. Tente novamente em instantes."], null),
        {
          status: 429,
          headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) },
        }
      );
    }

    const output = await createTeamCheckoutUseCase.execute({
      requesterProfileId: profileId,
      masterProfileId: managerId,
      teamName,
      billingType,
      requesterRole: teamMember.role,
      requesterFunctions: teamMember.functions ?? [],
    });

    if (!output.isValid) {
      const notFound = output.errorMessages.includes("Perfil não encontrado");
      return NextResponse.json(output, { status: notFound ? 404 : 400 });
    }

    return NextResponse.json(output, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/v1/teams/payments/create] Erro:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro ao criar pagamento"], null),
      { status: 500 }
    );
  }
}
