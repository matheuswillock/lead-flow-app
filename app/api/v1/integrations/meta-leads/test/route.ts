import { NextRequest, NextResponse } from "next/server";
import { metaLeadIntegrationRepository } from "@/app/api/infra/data/repositories/integrations/MetaLeadIntegrationRepository";
import { metaLeadService } from "@/app/api/services/MetaLeadService";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import { decryptToken } from "@/lib/integrations-crypto";
import { Output } from "@/lib/output";

export async function POST(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(new Output(false, [], ["ID do usuário é obrigatório"], null), { status: 401 });
    }

    const body = await request.json().catch(() => ({} as any));
    const pageId = body?.pageId as string | undefined;

    const profileUseCase = new RegisterNewUserProfile();
    const profileInfo = await profileUseCase.getProfileInfoBySupabaseId(supabaseId);
    if (!profileInfo) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), { status: 404 });
    }

    const managerId = profileInfo.isMaster ? profileInfo.id : profileInfo.managerId;
    if (!managerId) {
      return NextResponse.json(new Output(false, [], ["Manager não identificado"], null), { status: 400 });
    }

    const integration = pageId
      ? await metaLeadIntegrationRepository.findByPageId(pageId)
      : await metaLeadIntegrationRepository.findActiveByManagerId(managerId);

    if (!integration || integration.managerId !== managerId) {
      return NextResponse.json(new Output(false, [], ["Integração Meta não encontrada"], null), { status: 404 });
    }

    if (!integration.isActive) {
      return NextResponse.json(new Output(false, [], ["Integração Meta está desativada"], null), { status: 403 });
    }

    const accessToken = decryptToken(integration.pageAccessTokenEnc);
    const forms = await metaLeadService.getLeadgenForms(integration.pageId, accessToken);

    return NextResponse.json(new Output(true, ["Conexao validada"], [], {
      pageId: integration.pageId,
      totalForms: forms.length
    }));
  } catch (error) {
    console.error("Erro ao testar integração Meta:", error);
    return NextResponse.json(new Output(false, [], ["Erro ao testar integração"], null), { status: 500 });
  }
}
