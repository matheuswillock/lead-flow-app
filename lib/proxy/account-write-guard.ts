import { NextResponse } from "next/server"

/**
 * Escrita em leads e carteira exige conta com acesso pleno. Em somente leitura (dias 6 a 15)
 * e na tela de acesso pausado (dia 16 em diante) a API recusa a gravação, mesmo que a
 * requisição não venha pela interface.
 *
 * O caminho recebido é o recurso da API já sem a base (ex.: "leads/lead-1/status"); quem
 * conhece a base é o proxy.
 */
const GUARDED_API_RESOURCES = new Set(["leads", "portfolio"])
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export type RequireWritableAccess = (supabaseId: string) => Promise<NextResponse | null>

export function shouldGuardAccountWrite(apiResourcePath: string, method: string): boolean {
  if (READ_ONLY_METHODS.has(method.toUpperCase())) return false
  const [resource] = apiResourcePath.split("/")
  return GUARDED_API_RESOURCES.has(resource)
}

export function createAccountWriteGuard(requireWritable: RequireWritableAccess) {
  return async function guardAccountWrite(supabaseId: string): Promise<NextResponse | null> {
    try {
      return await requireWritable(supabaseId)
    } catch (error) {
      console.error("[Proxy] Falha ao verificar o acesso de escrita da conta:", error)
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 })
    }
  }
}

/** Versão de produção: carrega a regra de acesso só quando uma escrita guardada chega. */
export const guardAccountWrite = createAccountWriteGuard(async (supabaseId) => {
  const { requireWritableAccountAccess } = await import("@/app/api/v1/utils/requireActiveAccountAccess")
  return requireWritableAccountAccess(supabaseId)
})
