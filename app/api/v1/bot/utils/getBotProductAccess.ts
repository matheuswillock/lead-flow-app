import type { NextRequest } from "next/server";
import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";
import { Output } from "@/lib/output";
import { createSupabaseServer } from "@/lib/supabase/server";

export type BotProductAccess = {
  supabaseId: string;
  profileId: string;
  activeTeamId: string | null;
};

export type BotProductAccessResult =
  | { access: BotProductAccess; error?: never; status?: never }
  | { access?: never; error: Output; status: number };

export async function getBotProductAccess(request: NextRequest): Promise<BotProductAccessResult> {
  const supabase = await createSupabaseServer();
  if (!supabase) {
    return {
      error: new Output(false, [], ["Erro ao autenticar usuário"], null),
      status: 401,
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: new Output(false, [], ["Usuário não autenticado"], null),
      status: 401,
    };
  }

  const headerSupabaseId = request.headers.get("x-supabase-user-id");
  if (headerSupabaseId && headerSupabaseId !== user.id) {
    return {
      error: new Output(false, [], ["Não autorizado"], null),
      status: 403,
    };
  }

  const profile = await backofficeBotRepository.findProfileBotAccessBySupabaseId(user.id);

  if (!profile) {
    return {
      error: new Output(false, [], ["Perfil não encontrado"], null),
      status: 404,
    };
  }

  return {
    access: {
      supabaseId: user.id,
      profileId: profile.id,
      activeTeamId: profile.activeTeamId,
    },
  };
}
