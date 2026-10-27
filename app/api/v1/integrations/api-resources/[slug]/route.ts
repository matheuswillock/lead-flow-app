import { NextRequest, NextResponse, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { apiResourceActivationUseCase } from "@/app/api/useCases/apiStudio/apiResourceActivationInstance";

const routePrefix = "[ApiResourceActivationRoute]";

const PatchBodySchema = z.object({ status: z.enum(["active", "inactive"]) });

type RouteContext = { params: Promise<{ slug: string }> };

const resolveActor = async (request: NextRequest) => {
  const accessResult = await getTeamAccess(request);
  if ("error" in accessResult) {
    return { errorResponse: NextResponse.json(accessResult.error, { status: accessResult.status }) };
  }
  const { access } = accessResult;
  return { actor: { profileId: access.profileId, teamId: access.teamId, role: access.teamMember.role } };
};

const respond = (output: Output, successStatus = 200) =>
  NextResponse.json(output, {
    status: output.isValid ? successStatus : 400,
    headers: { "Cache-Control": "no-store" },
  });

/** Estado do recurso no time. Nunca devolve o token, só o preview. */
export async function GET(request: NextRequest, { params }: RouteContext) {
  await connection();
  try {
    const auth = await resolveActor(request);
    if ("errorResponse" in auth) return auth.errorResponse;
    const { slug } = await params;
    return respond(await apiResourceActivationUseCase.get(auth.actor, slug));
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[GET] Erro:`, error);
    return NextResponse.json(new Output(false, [], ["Erro ao carregar o recurso"], null), { status: 500 });
  }
}

/** Ativa (ou rotaciona o token). O token só aparece nesta resposta. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await resolveActor(request);
    if ("errorResponse" in auth) return auth.errorResponse;
    const { slug } = await params;
    return respond(await apiResourceActivationUseCase.activate(auth.actor, slug), 201);
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[POST] Erro:`, error);
    return NextResponse.json(new Output(false, [], ["Erro ao ativar o recurso"], null), { status: 500 });
  }
}

/** Liga ou desliga sem apagar o token. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await resolveActor(request);
    if ("errorResponse" in auth) return auth.errorResponse;
    const body = PatchBodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json(new Output(false, [], ["Informe status: active ou inactive"], null), { status: 400 });
    }
    const { slug } = await params;
    return respond(await apiResourceActivationUseCase.setStatus(auth.actor, slug, body.data.status));
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[PATCH] Erro:`, error);
    return NextResponse.json(new Output(false, [], ["Erro ao atualizar o recurso"], null), { status: 500 });
  }
}
