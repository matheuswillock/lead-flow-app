import { NextRequest, NextResponse } from "next/server";
import { UpdatePermanentSubscriptionUseCase } from "@/app/api/useCases/profiles/UpdatePermanentSubscriptionUseCase";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

/**
 * PUT /api/v1/profiles/[supabaseId]/permanent-subscription
 * Vitalício exclusivo do Backoffice (Estágio 0 / D6).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const { supabaseId: id } = await params;

    const accessResult = await getBackofficeAccess(request);
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }

    const denied = requireManagerAccess(accessResult.access);
    if (denied) return denied;

    const body = await request.json();
    const { hasPermanentSubscription } = body;

    if (typeof hasPermanentSubscription !== "boolean") {
      return NextResponse.json(
        {
          isValid: false,
          successMessages: [],
          errorMessages: ["Campo hasPermanentSubscription deve ser um boolean"],
          result: null,
        },
        { status: 400 }
      );
    }

    console.info("[PermanentSubscriptionRoute][PUT]", {
      targetSupabaseId: id,
      hasPermanentSubscription,
      actorProfileId: accessResult.access.profileId,
      actorBackofficeEmail: accessResult.access.backofficeEmail,
    });

    const useCase = new UpdatePermanentSubscriptionUseCase(profileRepository);
    const result = await useCase.updatePermanentSubscription(
      id,
      hasPermanentSubscription,
      accessResult.access.profileId
    );

    const statusCode = result.isValid ? 200 : 400;
    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[PermanentSubscriptionRoute][PUT] Erro:", error);

    return NextResponse.json(
      {
        isValid: false,
        successMessages: [],
        errorMessages: ["Erro interno do servidor"],
        result: null,
      },
      { status: 500 }
    );
  }
}
