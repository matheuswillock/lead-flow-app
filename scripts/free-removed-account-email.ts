/**
 * Libera um e-mail que ficou preso por uma conta removida ou por um operador
 * órfão, para que uma nova adesão possa usá-lo ("E-mail já cadastrado").
 *
 * O que faz (regras completas em `scripts/lib/free-removed-account-email.ts`):
 *   - perfil removido (deletedAt preenchido) com o e-mail: troca o e-mail por
 *     um tombstone `removido-<id>@removido.invalid`;
 *   - com `--deactivate-orphan-operators`, operador ativo sem vínculo nenhum
 *     (não master, sem time, sem subordinados, sem adesão) é desativado com o
 *     mesmo tombstone;
 *   - usuário do Supabase Auth com o e-mail sem perfil ativo: apaga.
 * Qualquer outra conta ativa com o e-mail bloqueia a execução inteira.
 *
 * Dry-run é o padrão. `--confirm` grava no banco apontado por DATABASE_URL e
 * no projeto Supabase de NEXT_PUBLIC_SUPABASE_URL: só rode com autorização do
 * owner. A execução é idempotente: reexecutar após falha parcial conclui o que
 * falta.
 *
 * Uso:
 *   bun run scripts/free-removed-account-email.ts --email nicholas@grpbr.com
 *   bun run scripts/free-removed-account-email.ts --email nicholas@grpbr.com --deactivate-orphan-operators --confirm
 */

import "dotenv/config"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  normalizeCleanupEmail,
  runEmailCleanup,
  type EmailCleanupAuthUser,
  type EmailCleanupDeps,
  type EmailCleanupProfile,
} from "./lib/free-removed-account-email"

const LOG = "[free-removed-account-email]"
const AUTH_PAGE_SIZE = 1000

function readEmailArg(argv: string[]): string {
  const index = argv.indexOf("--email")
  const value = index === -1 ? undefined : argv[index + 1]
  if (!value || value.startsWith("--")) {
    throw new Error("Informe o e-mail: --email <endereco>")
  }
  return value
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function listAuthUsersByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<EmailCleanupAuthUser[]> {
  const matches: EmailCleanupAuthUser[] = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE })
    if (error) throw new Error(`Falha ao listar usuários do Auth: ${error.message}`)

    for (const user of data.users) {
      if (user.email && normalizeCleanupEmail(user.email) === email) {
        matches.push({ id: user.id, email: user.email })
      }
    }
    if (data.users.length < AUTH_PAGE_SIZE) return matches
  }
}

async function countLinkedRecords(profileId: string): Promise<number> {
  const [teamMemberships, managedOperators, masteredTeams, adhesions] = await Promise.all([
    prisma.teamMember.count({ where: { profileId } }),
    prisma.profile.count({ where: { managerId: profileId, deletedAt: null } }),
    prisma.team.count({ where: { masterId: profileId, deletedAt: null } }),
    prisma.backofficeAdhesion.count({ where: { createdProfileId: profileId } }),
  ])
  return teamMemberships + managedOperators + masteredTeams + adhesions
}

async function loadProfiles(email: string, authIds: string[]): Promise<EmailCleanupProfile[]> {
  const rows = await prisma.profile.findMany({
    where: {
      OR: [
        { email: { equals: email, mode: "insensitive" } },
        { supabaseId: { in: authIds } },
      ],
    },
    select: { id: true, email: true, role: true, isMaster: true, supabaseId: true, deletedAt: true },
  })
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      role: String(row.role),
      linkedRecords: await countLinkedRecords(row.id),
    }))
  )
}

function createDeps(supabase: SupabaseClient): EmailCleanupDeps {
  const tombstone = async (profileId: string, newEmail: string, activate: boolean) => {
    // updateMany com a condição de estado garante que só mexe no perfil esperado.
    const { count } = await prisma.profile.updateMany({
      where: { id: profileId, ...(activate ? { deletedAt: null } : { deletedAt: { not: null } }) },
      data: activate ? { email: newEmail, deletedAt: new Date() } : { email: newEmail },
    })
    if (count !== 1) {
      throw new Error(`Perfil ${profileId} mudou de estado desde o planejamento: nada alterado`)
    }
  }

  return {
    loadSnapshot: async (email) => {
      const authUsers = await listAuthUsersByEmail(supabase, email)
      const profiles = await loadProfiles(
        email,
        authUsers.map((user) => user.id)
      )
      return { profiles, authUsers }
    },
    tombstoneProfileEmail: (profileId, newEmail) => tombstone(profileId, newEmail, false),
    deactivateOrphanProfile: (profileId, newEmail) => tombstone(profileId, newEmail, true),
    deleteAuthUser: async (authUserId) => {
      const { error } = await supabase.auth.admin.deleteUser(authUserId)
      if (error) throw new Error(`Falha ao apagar usuário do Auth ${authUserId}: ${error.message}`)
    },
    log: (message) => console.info(LOG, message),
  }
}

async function main(): Promise<void> {
  const email = readEmailArg(process.argv)
  const confirm = process.argv.includes("--confirm")
  const deactivateOrphanOperators = process.argv.includes("--deactivate-orphan-operators")
  const supabase = createAdminClient()

  try {
    const result = await runEmailCleanup(
      { email, confirm, deactivateOrphanOperators },
      createDeps(supabase)
    )
    if (result.status === "blocked") process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(LOG, error instanceof Error ? error.message : error)
  process.exitCode = 1
})
