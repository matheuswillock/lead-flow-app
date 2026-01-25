import { Output } from "@/lib/output";
import { NextRequest, NextResponse } from "next/server";
import { RequestToRegisterUserProfileOAuth, validateRegisterProfileRequestOAuth } from "@/app/api/v1/profiles/DTO/requestToRegisterUserProfile";
import { RegisterExistingUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import type { IProfileUseCase } from "@/app/api/useCases/profiles/IProfileUseCase";
import { createClient } from "@supabase/supabase-js";

const useCase: IProfileUseCase = new RegisterExistingUserProfile();

function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("[Supabase Admin] Credenciais nao configuradas");
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const supabaseId = req.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      const output = new Output(false, [], ["Supabase ID é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const body = await req.json();

    let validatedData: RequestToRegisterUserProfileOAuth;
    try {
      const basicData = validateRegisterProfileRequestOAuth(body);
      validatedData = {
        ...basicData,
        asaasCustomerId: body.asaasCustomerId,
        subscriptionId: body.subscriptionId,
        cpfCnpj: body.cpfCnpj,
        subscriptionStatus: body.subscriptionStatus,
        subscriptionPlan: body.subscriptionPlan,
        role: body.role,
        operatorCount: body.operatorCount,
        subscriptionStartDate: body.subscriptionStartDate ? new Date(body.subscriptionStartDate) : undefined,
        trialEndDate: body.trialEndDate ? new Date(body.trialEndDate) : undefined,
        postalCode: body.postalCode,
        address: body.address,
        addressNumber: body.addressNumber,
        neighborhood: body.neighborhood,
        complement: body.complement,
        city: body.city,
        state: body.state,
      };
    } catch (_validationError) {
      const output = new Output(false, [], ["Dados inválidos. Verifique os campos e tente novamente."], null);
      return NextResponse.json(output, { status: 400 });
    }

    const payload = { ...validatedData, supabaseId };
    const output = await useCase.registerUserProfile(payload as RequestToRegisterUserProfileOAuth);
    const status = output.isValid ? 201 : 400;

    if (output.isValid) {
      const supabaseAdmin = createSupabaseAdminClient();
      if (supabaseAdmin) {
        const existingPhone =
          (body?.phone && typeof body.phone === "string" && body.phone.trim()) || undefined;
        const existingFullName =
          (body?.fullname && typeof body.fullname === "string" && body.fullname.trim()) || undefined;
        await supabaseAdmin.auth.admin.updateUserById(supabaseId, {
          app_metadata: {
            provider: "google",
          },
          user_metadata: {
            phone: existingPhone,
            full_name: existingFullName,
          },
        });
      }
    }

    return NextResponse.json(output, { status });
  } catch (error) {
    console.error("Erro ao criar perfil OAuth:", error);
    const output = new Output(false, [], ["Falha ao criar perfil do usuário"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
