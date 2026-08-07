import { NextResponse, connection } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET() {
  await connection();

  try {
    const supabase = await createSupabaseServer();
    if (!supabase) {
      const output = new Output(false, [], ["Serviço de autenticação indisponível"], null);
      return NextResponse.json(output, { status: 500 });
    }

    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      const output = new Output(false, [], ["Sessão não autenticada"], null);
      return NextResponse.json(output, { status: 401 });
    }

    const output = new Output(true, ["Token de realtime obtido"], [], {
      accessToken: data.session.access_token,
    });
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[RealtimeAuthTokenRoute][GET] Erro ao obter token de realtime:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
