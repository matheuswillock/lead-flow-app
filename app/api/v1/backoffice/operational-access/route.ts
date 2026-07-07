import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess";
import { backofficeOperationalAccessUseCase } from "@/app/api/useCases/backofficeOperationalAccess/BackofficeOperationalAccessUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function GET(request: NextRequest) {
  try {
    console.info("[BackofficeOperationalAccessRoute][GET] iniciado");
    const result = await getBackofficeAccess(request);
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status });
    }
    const denied = requireMasterAccess(result.access);
    if (denied) return denied;

    const output = await backofficeOperationalAccessUseCase.list();
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeOperationalAccessRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.info("[BackofficeOperationalAccessRoute][POST] iniciado");
    const result = await getBackofficeAccess(request);
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status });
    }
    const denied = requireMasterAccess(result.access);
    if (denied) return denied;

    const body = (await request.json()) as {
      capability?: "ASSOCIADOS_QUEUE" | "MULTISKILL_TRANSFER_ORIGIN";
      profileId?: string;
      masterId?: string;
      notes?: string | null;
    };

    if (body.capability === "ASSOCIADOS_QUEUE") {
      if (!body.profileId) {
        return NextResponse.json(new Output(false, [], ["Selecione um perfil"], null), {
          status: 400,
        });
      }
      const output = await backofficeOperationalAccessUseCase.grantAssociados(
        body.profileId,
        result.access.profileId,
        body.notes
      );
      return NextResponse.json(output, { status: output.isValid ? 201 : 400 });
    }

    if (body.capability === "MULTISKILL_TRANSFER_ORIGIN") {
      if (!body.masterId) {
        return NextResponse.json(new Output(false, [], ["Selecione uma conta"], null), {
          status: 400,
        });
      }
      const output = await backofficeOperationalAccessUseCase.grantMultiskillOrigin(
        body.masterId,
        result.access.profileId,
        body.notes
      );
      return NextResponse.json(output, { status: output.isValid ? 201 : 400 });
    }

    return NextResponse.json(new Output(false, [], ["Capability inválida"], null), { status: 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeOperationalAccessRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
