import { NextRequest, NextResponse } from "next/server";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess";
import { approveAdhesionDiscountUseCase } from "@/app/api/useCases/backofficeAdhesion/ApproveAdhesionDiscountUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

/**
 * POST /api/v1/backoffice/adhesions/[id]/approve-discount
 * Estágio 10 / D10 — aprova desconto acima do teto.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const access = await getBackofficeAccess(request);
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status });
    }
    const denied = requireManagerAccess(access.access);
    if (denied) return denied;

    const result = await approveAdhesionDiscountUseCase.execute({
      adhesionId: id,
      actorProfileId: access.access.profileId,
    });

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[ApproveAdhesionDiscountRoute][POST]", error);
    return NextResponse.json(
      {
        isValid: false,
        successMessages: [],
        errorMessages: ["Erro interno"],
        result: null,
      },
      { status: 500 }
    );
  }
}
