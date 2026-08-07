import type { NextRequest } from "next/server"
import { NextResponse, connection } from "next/server";
import { Output } from "@/lib/output"
import { createSupabaseServer } from "@/lib/supabase/server"
import { getMyGoogleScopesUseCase } from "@/app/api/useCases/google/GetMyGoogleScopesUseCase"

const LOG_PREFIX = "[GoogleScopesRoute][GET]"

export async function GET(_request: NextRequest) {
  await connection();

  const supabase = await createSupabaseServer()
  if (!supabase) {
    console.error(`${LOG_PREFIX} Falha ao criar cliente Supabase`)
    return NextResponse.json(new Output(false, [], ["Erro ao autenticar usuario"], null), {
      status: 401,
    })
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(new Output(false, [], ["Usuario nao autenticado"], null), {
      status: 401,
    })
  }

  const output = await getMyGoogleScopesUseCase(user.id)

  if (!output.isValid) {
    return NextResponse.json(output, { status: 400 })
  }

  return NextResponse.json(output)
}
