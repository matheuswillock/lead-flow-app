import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { apiResourceActivationUseCase } from "@/app/api/useCases/apiStudio/apiResourceActivationInstance";

const routePrefix = "[ApiResourceUsageRoute]";

type RouteContext = { params: Promise<{ slug: string }> };

/** Últimas consultas ao recurso da API Studio (SPEC 14, A-E4). Só manager do time; só metadados. */
export async function GET(request: NextRequest, { params }: RouteContext) {
  await connection();
  try {
    const accessResult = await getTeamAccess(request);
    if ("error" in accessResult) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }
    const { access } = accessResult;
    const { slug } = await params;
    const output = await apiResourceActivationUseCase.usage(
      { profileId: access.profileId, teamId: access.teamId, role: access.teamMember.role },
      slug,
    );
    return NextResponse.json(output, {
      status: output.isValid ? 200 : 400,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[GET] Erro:`, error);
    return NextResponse.json(new Output(false, [], ["Erro ao carregar o uso do recurso"], null), { status: 500 });
  }
}
