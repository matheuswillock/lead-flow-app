import { NextRequest, NextResponse } from "next/server";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import { whatsAppIntegrationRepository } from "@/app/api/infra/data/repositories/integrations/WhatsAppIntegrationRepository";
import { decryptToken } from "@/lib/integrations-crypto";
import { whatsAppCloudService } from "@/app/api/services/whatsapp/WhatsAppCloudService";
import { Output } from "@/lib/output";

export async function POST(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(new Output(false, [], ["ID do usuário é obrigatório"], null), { status: 401 });
    }

    const body = await request.json().catch(() => ({} as any));
    const phoneNumberId = body?.phoneNumberId as string | undefined;

    const profileUseCase = new RegisterNewUserProfile();
    const profileInfo = await profileUseCase.getProfileInfoBySupabaseId(supabaseId);
    if (!profileInfo) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), { status: 404 });
    }

    const managerId = profileInfo.isMaster ? profileInfo.id : profileInfo.managerId;
    if (!managerId) {
      return NextResponse.json(new Output(false, [], ["Manager não identificado"], null), { status: 400 });
    }

    const integration = phoneNumberId
      ? await whatsAppIntegrationRepository.findByPhoneNumberId(phoneNumberId)
      : await whatsAppIntegrationRepository.findActiveByManagerId(managerId);

    if (!integration || integration.managerId !== managerId) {
      return NextResponse.json(new Output(false, [], ["Integração WhatsApp não encontrada"], null), { status: 404 });
    }

    if (!integration.isActive) {
      return NextResponse.json(new Output(false, [], ["Integração WhatsApp está desativada"], null), { status: 403 });
    }

    const accessToken = decryptToken(integration.accessTokenEnc);
    const info = await whatsAppCloudService.getPhoneNumberInfo(integration.phoneNumberId, accessToken);

    return NextResponse.json(new Output(true, ["Conexao validada"], [], {
      phoneNumberId: integration.phoneNumberId,
      displayPhoneNumber: info.display_phone_number,
      verifiedName: info.verified_name
    }));
  } catch (error) {
    console.error("Erro ao testar integração WhatsApp:", error);
    return NextResponse.json(new Output(false, [], ["Erro ao testar integração"], null), { status: 500 });
  }
}
