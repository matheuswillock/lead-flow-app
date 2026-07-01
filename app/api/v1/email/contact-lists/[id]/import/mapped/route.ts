import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { EmailContactListUseCase } from "@/app/api/useCases/email/EmailContactListUseCase";
import { isManagerLikeRole } from "@/lib/roles";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { MappedEmailContactImportRequestSchema } from "./DTO/mappedEmailContactImportRequest";

function makeUseCase() {
  return new EmailContactListUseCase();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem importar contatos"], null),
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = MappedEmailContactImportRequestSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Payload inválido";
      return NextResponse.json(new Output(false, [], [message], null), { status: 400 });
    }

    const useCase = makeUseCase();
    const output = await useCase.importMapped(id, parsed.data.rows, teamAccess.access);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailContactListImportMappedRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno ao importar contatos"], null), {
      status: 500,
    });
  }
}
