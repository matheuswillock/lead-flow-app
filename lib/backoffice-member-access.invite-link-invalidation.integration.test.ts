import { describe, expect, it } from "bun:test"
import { createClient } from "@supabase/supabase-js"

/**
 * Integração contra Supabase Auth (GoTrue) real — Entregável 2 do bug de reenvio de
 * convite (2026-08-27): prova, não assume, que gerar um convite novo invalida o
 * anterior.
 *
 * NÃO EXECUTADO nesta sessão de agente. Mesmo motivo documentado em
 * `lib/account-users/manager-account-users.integration.test.ts`: as únicas
 * credenciais Supabase disponíveis nesta máquina/ambiente apontam para PRODUÇÃO
 * (`createSupabaseAdmin` em `lib/supabase/server.ts` inclusive bloqueia por padrão
 * ações admin quando os marcadores de stack local db-only/híbrido estão ativos, com
 * `SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN` como escape explícito só para projeto de
 * desenvolvimento isolado). `generateLink({ type: "invite" })` cria/mexe em usuário
 * de verdade — rodar sem um Supabase local de verdade (ou um projeto de dev
 * isolado, nunca produção) mutaria dados reais. Sem `docker`/`supabase` CLI
 * disponíveis neste ambiente para subir uma stack local, a execução real fica para
 * quem rodar localmente.
 *
 * Decisão documentada (sem execução real): GoTrue guarda o token de confirmação
 * pendente como COLUNA única em `auth.users` por tipo de ação (não uma tabela de
 * tokens à parte) — um usuário tem no máximo um token de convite ativo por vez, e
 * `generateLink` sobrescreve essa coluna a cada chamada. Isso é o que a
 * documentação pública da Supabase descreve para `admin.generateLink` (o link
 * anterior do mesmo tipo deixa de validar assim que um novo é emitido) e é a
 * premissa que a nota do bug já assumia — este teste existe para PROVAR isso com
 * banco real, não para introduzir a suposição.
 *
 * Rodar (contra um projeto Supabase de DESENVOLVIMENTO isolado — nunca produção):
 *   INVITE_LINK_INVALIDATION_INTEGRATION_TEST=1 \
 *   NEXT_PUBLIC_SUPABASE_URL=https://<projeto-dev>.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-dev> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-dev> \
 *   bun test lib/backoffice-member-access.invite-link-invalidation.integration.test.ts
 */
const RUN_INTEGRATION = process.env.INVITE_LINK_INVALIDATION_INTEGRATION_TEST === "1"

function assertNotProductionSupabaseUrl(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  // Guarda best-effort: bloqueia o projeto de produção conhecido por nome de
  // domínio; não substitui revisão humana do valor antes de rodar.
  if (/corretorstudio|leadflow/i.test(url)) {
    throw new Error(
      "[integration] abortado: NEXT_PUBLIC_SUPABASE_URL parece o projeto de produção. " +
        "generateLink cria usuário de verdade — use um projeto Supabase de desenvolvimento isolado."
    )
  }
  if (!url) {
    throw new Error("[integration] abortado: NEXT_PUBLIC_SUPABASE_URL ausente.")
  }
}

describe.if(RUN_INTEGRATION)(
  "GoTrue invalida o convite anterior quando um novo é gerado (Entregável 2)",
  () => {
    it("token do convite A para de autenticar depois que o convite B é gerado; token B autentica", async () => {
      assertNotProductionSupabaseUrl()

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

      const admin = createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const anon = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const email = `invite-invalidation-test-${Date.now()}@example.com`

      try {
        const first = await admin.auth.admin.generateLink({
          type: "invite",
          email,
          options: { data: { name: "Teste Invalidação A" } },
        })
        expect(first.error).toBeNull()
        const hashedTokenA = first.data?.properties?.hashed_token
        expect(hashedTokenA).toBeTruthy()

        const second = await admin.auth.admin.generateLink({
          type: "invite",
          email,
          options: { data: { name: "Teste Invalidação B" } },
        })
        expect(second.error).toBeNull()
        const hashedTokenB = second.data?.properties?.hashed_token
        expect(hashedTokenB).toBeTruthy()
        expect(hashedTokenB).not.toBe(hashedTokenA)

        // Token A (o do convite original) não deve mais autenticar.
        const verifyA = await anon.auth.verifyOtp({
          token_hash: hashedTokenA as string,
          type: "invite",
        })
        expect(verifyA.error).not.toBeNull()

        // Token B (o do reenvio) autentica normalmente.
        const verifyB = await anon.auth.verifyOtp({
          token_hash: hashedTokenB as string,
          type: "invite",
        })
        expect(verifyB.error).toBeNull()
        expect(verifyB.data.session).toBeTruthy()
      } finally {
        const { data } = await admin.auth.admin.listUsers()
        const created = data?.users?.find((u) => u.email === email)
        if (created) {
          await admin.auth.admin.deleteUser(created.id)
        }
      }
    })
  }
)
