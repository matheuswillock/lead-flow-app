import { NextRequest, NextResponse } from "next/server";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import { validateUpdatePasswordRequest } from "../../DTO/requestToUpdatePassword";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const profileUseCase = new RegisterNewUserProfile();

/**
 * PUT /api/v1/profiles/[supabaseId]/password
 * Atualiza apenas a senha do usuário
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  let supabaseId = '';
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const originScreen = request.headers.get('x-origin-screen') || 'unknown';
  const requestedAt = new Date().toISOString();

  try {
    supabaseId = (await params).supabaseId;

    if (!supabaseId) {
      const output = new Output(false, [], ["Supabase ID is required"], null);
      return NextResponse.json(output, { status: 400 });
    }

    console.info('🔑 [Change Password] Solicitação de alteração de senha', {
      requestUserId: supabaseId,
      originScreen,
      path: 'PUT /api/v1/profiles/[supabaseId]/password',
      ip,
      userAgent,
      requestedAt,
    });

    const body = await request.json();

    let validatedData;
    try {
      validatedData = validateUpdatePasswordRequest(body);
    } catch (validationError) {
      const output = new Output(false, [], [(validationError as Error).message], null);
      return NextResponse.json(output, { status: 400 });
    }

    const result = await profileUseCase.updatePassword(supabaseId, validatedData.password);

    if (!result.isValid) {
      return NextResponse.json(result, {
        status: result.errorMessages.includes("Profile not found") ? 404 : 400
      });
    }

    console.info('✅ [Change Password] Senha alterada com sucesso', {
      requestUserId: supabaseId,
      originScreen,
      path: 'PUT /api/v1/profiles/[supabaseId]/password',
      ip,
      userAgent,
      requestedAt,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error('[Change Password][PUT /api/v1/profiles/[supabaseId]/password] Erro inesperado', {
      requestUserId: supabaseId,
      originScreen,
      ip,
      requestedAt,
      error,
    });
    const output = new Output(false, [], ["Internal server error"], null);
    return NextResponse.json(output, { status: 500 });
  }
}