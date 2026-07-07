import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess";
import { backofficeOperationalAccessUseCase } from "@/app/api/useCases/backofficeOperationalAccess/BackofficeOperationalAccessUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> }
) {
  try {
    const { grantId } = await params;
    console.info("[BackofficeOperationalAccessByIdRoute][DELETE] iniciado");
    const result = await getBackofficeAccess(request);
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status });
    }
    const denied = requireMasterAccess(result.access);
    if (denied) return denied;

    const output = await backofficeOperationalAccessUseCase.revoke(
      grantId,
      result.access.profileId
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeOperationalAccessByIdRoute][DELETE]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
