/**
 * fix-roger-email-auth.ts
 *
 * Contexto:
 *   O e-mail do operador Roger foi atualizado manualmente direto na tabela `profiles`
 *   (Prisma) para "goncales.ro@gmail.com", mas o registro correspondente no Supabase
 *   Auth (uid: aaf4db84-978f-44d9-aa69-9f2731fde111) ainda tem o e-mail antigo
 *   "roger@corp.gsvida.com.br".
 *
 *   Além disso, existe um segundo registro na Auth com o mesmo e-mail "goncales.ro@gmail.com"
 *   (uid: 7d31929f-78fe-4da4-abda-4242a75835b9) criado via login Google — esse registro
 *   NÃO possui profile vinculado e deve ser removido para evitar conflito.
 *
 * Ações executadas (em ordem):
 *   1. Verificar estado atual (sempre roda, mesmo em dry-run)
 *   2. Deletar auth user órfão (7d31929f...) — conta Google sem profile
 *   3. Atualizar e-mail do auth user principal (aaf4db84...) para "goncales.ro@gmail.com"
 *
 * Uso:
 *   Dry-run (apenas lê e imprime o que faria):
 *     bun run scripts/admin/fix-roger-email-auth.ts --dry-run
 *
 *   Execução real:
 *     bun run scripts/admin/fix-roger-email-auth.ts --confirm
 */

import "dotenv/config"
import { createClient } from "@supabase/supabase-js"
import { prisma } from "@/app/api/infra/data/prisma"

// ---------------------------------------------------------------------------
// Constantes — ajuste se necessário
// ---------------------------------------------------------------------------

const PROFILE_SUPABASE_ID = "aaf4db84-978f-44d9-aa69-9f2731fde111" // auth user a corrigir
const ORPHAN_AUTH_ID = "7d31929f-78fe-4da4-abda-4242a75835b9"       // auth user órfão (Google)
const TARGET_EMAIL = "goncales.ro@gmail.com"

// ---------------------------------------------------------------------------

function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const confirm = process.argv.includes("--confirm")

  if (!dryRun && !confirm) {
    console.error("Refusing to run without flag. Use --dry-run to preview or --confirm to execute.")
    process.exit(1)
  }

  console.info("[fix-roger] START", { dryRun })

  const supabase = createSupabaseAdminClient()

  // ---------------------------------------------------------------------------
  // 1. Verificar estado atual
  // ---------------------------------------------------------------------------

  console.info("\n[fix-roger] --- ESTADO ATUAL ---")

  const profile = await prisma.profile.findUnique({
    where: { supabaseId: PROFILE_SUPABASE_ID },
    select: { id: true, email: true, supabaseId: true, fullName: true },
  })

  if (!profile) {
    console.error(`[fix-roger] ERRO: Nenhum profile encontrado com supabaseId=${PROFILE_SUPABASE_ID}`)
    process.exit(1)
  }

  console.info("[fix-roger] Profile no banco:", profile)

  const { data: mainAuthData, error: mainAuthError } = await supabase.auth.admin.getUserById(PROFILE_SUPABASE_ID)
  if (mainAuthError) {
    console.error("[fix-roger] ERRO ao buscar auth user principal:", mainAuthError.message)
    process.exit(1)
  }
  const mainAuthUser = mainAuthData?.user
  console.info("[fix-roger] Auth user principal:", {
    id: mainAuthUser?.id,
    email: mainAuthUser?.email,
    provider: mainAuthUser?.app_metadata?.provider,
  })

  const { data: orphanAuthData } = await supabase.auth.admin.getUserById(ORPHAN_AUTH_ID)
  const orphanAuthUser = orphanAuthData?.user
  console.info("[fix-roger] Auth user órfão:", orphanAuthUser
    ? { id: orphanAuthUser.id, email: orphanAuthUser.email, provider: orphanAuthUser.app_metadata?.provider }
    : "Não encontrado (já removido)"
  )

  // Verificar se o profile da orphan existe (não deveria)
  const orphanProfile = await prisma.profile.findUnique({
    where: { supabaseId: ORPHAN_AUTH_ID },
    select: { id: true, email: true },
  })
  if (orphanProfile) {
    console.error(
      `[fix-roger] ATENÇÃO: O auth órfão (${ORPHAN_AUTH_ID}) possui um profile vinculado:`,
      orphanProfile,
      "\nRevise manualmente antes de prosseguir."
    )
    process.exit(1)
  }
  console.info("[fix-roger] Confirmado: auth órfão não possui profile vinculado.")

  if (mainAuthUser?.email === TARGET_EMAIL) {
    console.info("[fix-roger] Auth principal já possui o e-mail correto. Nada a atualizar na Auth.")
  }

  // ---------------------------------------------------------------------------
  // 2. Deletar auth user órfão
  // ---------------------------------------------------------------------------

  console.info("\n[fix-roger] --- AÇÃO 1: Deletar auth user órfão ---")

  if (!orphanAuthUser) {
    console.info("[fix-roger] Órfão não encontrado — pulando.")
  } else if (dryRun) {
    console.info(`[fix-roger] [DRY-RUN] Deletaria auth user órfão: ${ORPHAN_AUTH_ID} (${orphanAuthUser.email})`)
  } else {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(ORPHAN_AUTH_ID)
    if (deleteError) {
      console.error("[fix-roger] ERRO ao deletar órfão:", deleteError.message)
      process.exit(1)
    }
    console.info(`[fix-roger] ✅ Auth user órfão deletado: ${ORPHAN_AUTH_ID}`)
  }

  // ---------------------------------------------------------------------------
  // 3. Atualizar e-mail no auth user principal
  // ---------------------------------------------------------------------------

  console.info("\n[fix-roger] --- AÇÃO 2: Atualizar e-mail do auth user principal ---")

  if (mainAuthUser?.email === TARGET_EMAIL) {
    console.info("[fix-roger] Nada a fazer — e-mail já está correto.")
  } else if (dryRun) {
    console.info(
      `[fix-roger] [DRY-RUN] Atualizaria auth user ${PROFILE_SUPABASE_ID}:`,
      `email "${mainAuthUser?.email}" → "${TARGET_EMAIL}"`
    )
  } else {
    const { data: updatedData, error: updateError } = await supabase.auth.admin.updateUserById(
      PROFILE_SUPABASE_ID,
      { email: TARGET_EMAIL, email_confirm: true }
    )
    if (updateError) {
      console.error("[fix-roger] ERRO ao atualizar e-mail:", updateError.message)
      process.exit(1)
    }
    console.info(`[fix-roger] ✅ E-mail atualizado no Supabase Auth:`, {
      id: updatedData?.user?.id,
      email: updatedData?.user?.email,
    })
  }

  console.info("\n[fix-roger] DONE", { dryRun })
}

main()
  .catch((err) => {
    console.error("[fix-roger] FAILED:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null)
  })
