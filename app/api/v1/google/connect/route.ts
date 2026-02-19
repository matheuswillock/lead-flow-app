import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";

const LOG_PREFIX = "[GoogleConnect]";

const connectSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
  email: z.string().email().optional(),
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
    supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      logError("Supabase ID ausente no header.", {
        status: "error",
        step: "auth_header",
        supabaseId,
        email: emailForLog,
      });
      const output = new Output(false, [], ["ID do usuario e obrigatorio"], null);
      return NextResponse.json(output, { status: 401 });
    }

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

    const { accessToken, refreshToken, expiresAt, email } = validation.data;

    const profile = await profileRepository.updateGoogleCalendarAuth(supabaseId, {
      accessToken,
      refreshToken: refreshToken ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      email: email ?? null,
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
