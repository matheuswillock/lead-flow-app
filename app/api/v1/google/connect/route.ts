import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { createSupabaseServer } from "@/lib/supabase/server";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { googleOAuthConnectionRepository } from "@/app/api/infra/data/repositories/googleOAuthConnection/GoogleOAuthConnectionRepository";
import { googleConnectionUseCase } from "@/app/api/useCases/googleConnection/GoogleConnectionUseCase";
import { fetchGoogleGrantedScopes } from "@/lib/google/scopes";
import { shouldNotifyGoogleConnected as shouldNotifyGoogleConnectedDecision } from "@/lib/google/should-notify-google-connect";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const LOG_PREFIX = "[GoogleConnect]";

const connectSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
  email: z.string().email().optional(),
  source: z.enum(["login", "account"]).optional(),
});

const logInfo = (message: string, context: Record<string, unknown>) => {
  console.info(`${LOG_PREFIX} ${message}`, { ...context, timestamp: new Date().toISOString() });
};

const logError = (message: string, context: Record<string, unknown>) => {
  console.error(`${LOG_PREFIX} ${message}`, { ...context, timestamp: new Date().toISOString() });
};

export async function POST(request: NextRequest) {
  let supabaseId: string | null = null;
  let emailForLog: string | null = null;
  let tokenFlags = { hasAccessToken: false, hasRefreshToken: false };

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

    const body = await request.json();
    const validation = connectSchema.safeParse(body);

    emailForLog = typeof body?.email === "string" ? body.email : null;
    tokenFlags = {
      hasAccessToken: typeof body?.accessToken === "string" && body.accessToken.length > 0,
      hasRefreshToken: typeof body?.refreshToken === "string" && body.refreshToken.length > 0,
    };

    if (!validation.success) {
      logError("Falha na validacao do payload.", {
        status: "error",
        step: "validation",
        supabaseId,
        email: emailForLog,
        tokenFlags,
        issues: validation.error.issues.map((issue) => issue.message),
      });
      const output = new Output(
        false,
        [],
        validation.error.issues.map((issue) => issue.message),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    const { accessToken, refreshToken, expiresAt, email, source = "login" } = validation.data;

    const currentProfile = await profileRepository.findBySupabaseId(supabaseId);
    if (!currentProfile) {
      logError("Perfil nao encontrado para o usuario autenticado.", {
        status: "error",
        step: "profile_lookup",
        supabaseId,
      });
      const output = new Output(false, [], ["Perfil nao encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    // Resolve o email final antes do conflict check para cobrir tanto o caso em
    // que email é fornecido explicitamente quanto o fallback para currentProfile.email.
    const currentConnection = currentProfile.googleConnectionId
      ? await googleOAuthConnectionRepository.findById(currentProfile.googleConnectionId)
      : null;
    const previousGoogleEmail = currentConnection?.googleEmail ?? null;
    const normalizedNextGoogleEmail = email ?? currentProfile.email;

    // Conflict check: rejeitar se o email final já está vinculado a OUTRO perfil.
    // Rodar mesmo quando email não foi enviado no body, pois currentProfile.email
    // pode já estar em google_oauth_connections com outro ownerProfileId.
    if (normalizedNextGoogleEmail) {
      const existingConnection =
        await googleOAuthConnectionRepository.findByGoogleEmail(normalizedNextGoogleEmail);
      if (
        existingConnection?.ownerProfileId &&
        existingConnection.ownerProfileId !== currentProfile.id
      ) {
        logError("Tentativa de vincular Google email ja associado a outro perfil.", {
          status: "error",
          step: "google_email_conflict",
          supabaseId,
          email: normalizedNextGoogleEmail,
          emailWasExplicit: Boolean(email),
          conflictingProfileId: existingConnection.ownerProfileId,
        });
        const output = new Output(
          false,
          [],
          ["Este e-mail Google ja esta vinculado a outro usuario."],
          null
        );
        return NextResponse.json(output, { status: 409 });
      }
    }
    const notifyConnected = shouldNotifyGoogleConnectedDecision({
      source,
      hadConnectionId: !!currentProfile.googleConnectionId,
      connection: currentConnection,
      previousGoogleEmail: previousGoogleEmail ?? null,
      nextGoogleEmail: normalizedNextGoogleEmail ?? null,
    });

    const profile = await profileRepository.updateGoogleCalendarAuth(supabaseId, {
      accessToken,
      refreshToken: refreshToken ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      email: normalizedNextGoogleEmail,
      connected: Boolean(refreshToken || accessToken),
    });

    if (!profile) {
      logError("Falha ao salvar credenciais do Google.", {
        status: "error",
        step: "persist",
        supabaseId,
        email: email ?? null,
        tokenFlags: {
          hasAccessToken: Boolean(accessToken),
          hasRefreshToken: Boolean(refreshToken),
        },
      });
      const output = new Output(false, [], ["Falha ao salvar credenciais Google"], null);
      return NextResponse.json(output, { status: 400 });
    }

    if (profile.googleConnectionId) {
      const grantedScopes = await fetchGoogleGrantedScopes(accessToken).catch(() => []);
      await googleOAuthConnectionRepository.updateTokens(profile.googleConnectionId, {
        scopes: grantedScopes,
      });
    }

    if (email && previousGoogleEmail && previousGoogleEmail !== email) {
      logInfo("Google email atualizado para o perfil autenticado.", {
        status: "success",
        step: "google_email_changed",
        supabaseId,
        previousGoogleEmail,
        newGoogleEmail: email,
      });
    }

    if (notifyConnected) {
      const notifyOutput = await googleConnectionUseCase.notifyGoogleConnected({
        supabaseId,
        profileId: currentProfile.id,
        activeTeamId: currentProfile.activeTeamId ?? null,
        googleEmail: normalizedNextGoogleEmail,
        previousGoogleEmail,
      });

      if (!notifyOutput.isValid) {
        logError("Falha ao registrar notificacao de conexao Google.", {
          status: "error",
          step: "notify_connect",
          supabaseId,
          email: email ?? null,
          errors: notifyOutput.errorMessages,
        });
      }
    }

    logInfo("Google conectado com sucesso.", {
      status: "success",
      step: "persist",
      supabaseId,
      email: email ?? null,
      tokenFlags: {
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken),
      },
    });

    return NextResponse.json(new Output(true, ["Google conectado"], [], null), { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    logError("Erro inesperado ao conectar Google.", {
      status: "error",
      step: "unexpected",
      supabaseId,
      email: emailForLog,
      tokenFlags,
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : { message: String(error) },
    });
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
