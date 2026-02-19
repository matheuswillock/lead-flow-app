import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";

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
    supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      logError("Supabase ID ausente no header.", { status: "error", step: "auth_header" });
      const output = new Output(false, [], ["ID do usuario e obrigatorio"], null);
      return NextResponse.json(output, { status: 401 });
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
