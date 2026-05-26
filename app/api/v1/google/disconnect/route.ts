import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { createSupabaseServer } from "@/lib/supabase/server";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { googleConnectionUseCase } from "@/app/api/useCases/googleConnection/GoogleConnectionUseCase";
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/BackofficeUserRepository";
import { googleOAuthConnectionRepository } from "@/app/api/infra/data/repositories/googleOAuthConnection/GoogleOAuthConnectionRepository";

const LOG_PREFIX = "[GoogleDisconnect]";

const logInfo = (message: string, context: Record<string, unknown>) => {
  console.info(`${LOG_PREFIX} ${message}`, { ...context, timestamp: new Date().toISOString() });
};

const logError = (message: string, context: Record<string, unknown>) => {
  console.error(`${LOG_PREFIX} ${message}`, { ...context, timestamp: new Date().toISOString() });
};

export async function POST(request: NextRequest) {
  let supabaseId: string | null = null;

  try {
    const supabase = await createSupabaseServer();
    if (!supabase) {
      logError("Falha ao criar cliente Supabase.", { status: "error", step: "auth_client" });
      const output = new Output(false, [], ["Erro ao autenticar usuario"], null);
      return NextResponse.json(output, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logError("Usuario nao autenticado.", { status: "error", step: "auth_session" });
      const output = new Output(false, [], ["Usuario nao autenticado"], null);
      return NextResponse.json(output, { status: 401 });
    }

    const headerSupabaseId = request.headers.get("x-supabase-user-id");
    if (headerSupabaseId && headerSupabaseId !== user.id) {
      logError("Supabase ID do header nao corresponde ao usuario autenticado.", {
        status: "error",
        step: "auth_header_mismatch",
        headerSupabaseId,
        supabaseId: user.id,
      });
      const output = new Output(false, [], ["Nao autorizado"], null);
      return NextResponse.json(output, { status: 403 });
    }

    supabaseId = user.id;

    const body = await request.json().catch(() => ({}))
    const force = body?.force === true
    const currentProfile = await profileRepository.findBySupabaseId(supabaseId);
    const backofficeUserRepository = new BackofficeUserRepository()
    const disconnectedEmail = currentProfile?.googleEmail ?? currentProfile?.email ?? null;

    if (!currentProfile) {
      const output = new Output(false, [], ["Perfil nao encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    if (currentProfile.googleConnectionId) {
      const linkedDependents = await backofficeUserRepository.findByLinkedProfileId(currentProfile.id)
      if (linkedDependents.length > 0 && !force) {
        const output = new Output(
          false,
          [],
          ["Existem usuarios backoffice dependentes desta conexao. Reenvie com force=true para confirmar."],
          { dependents: linkedDependents }
        )
        return NextResponse.json(output, { status: 409 })
      }
    }

    const profile = await profileRepository.updateGoogleCalendarAuth(supabaseId, {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      email: null,
      connected: false,
    });

    if (!profile) {
      logError("Falha ao desconectar Google.", { status: "error", step: "persist", supabaseId });
      const output = new Output(false, [], ["Falha ao desconectar Google"], null);
      return NextResponse.json(output, { status: 400 });
    }

    if (currentProfile.googleConnectionId) {
      const dependents = await backofficeUserRepository.findByGoogleConnectionId(
        currentProfile.googleConnectionId
      )
      if (dependents.length === 0) {
        await googleOAuthConnectionRepository.markRevoked(
          currentProfile.googleConnectionId,
          "Disconnected by profile owner"
        )
      }
    }

    const { data: identitiesData, error: identitiesError } = await supabase.auth.getUserIdentities();
    if (identitiesError) {
      logError("Falha ao buscar identities do usuario.", { status: "error", step: "get_identities", supabaseId, error: identitiesError.message });
    } else {
      const googleIdentity = identitiesData?.identities?.find((i) => i.provider === "google");
      if (googleIdentity) {
        const { error: unlinkError } = await supabase.auth.unlinkIdentity(googleIdentity);
        if (unlinkError) {
          logError("Falha ao remover identity Google do Supabase Auth.", { status: "error", step: "unlink_identity", supabaseId, error: unlinkError.message });
        } else {
          logInfo("Identity Google removida do Supabase Auth.", { status: "success", step: "unlink_identity", supabaseId });
        }
      }
    }

    const notifyOutput = await googleConnectionUseCase.notifyGoogleDisconnected({
      supabaseId,
      profileId: currentProfile.id,
      activeTeamId: currentProfile.activeTeamId ?? null,
      googleEmail: disconnectedEmail,
    });

      if (!notifyOutput.isValid) {
        logError("Falha ao registrar notificacao de desconexao Google.", {
          status: "error",
          step: "notify_disconnect",
          supabaseId,
          email: disconnectedEmail,
          errors: notifyOutput.errorMessages,
        });
      }

    logInfo("Google desconectado com sucesso.", {
      status: "success",
      step: "persist",
      supabaseId,
    });

    return NextResponse.json(new Output(true, ["Google desconectado"], [], null), { status: 200 });
  } catch (error) {
    logError("Erro inesperado ao desconectar Google.", {
      status: "error",
      step: "unexpected",
      supabaseId,
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : { message: String(error) },
    });
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
