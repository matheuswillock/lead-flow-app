import "dotenv/config"

import { createClient } from "@supabase/supabase-js"
import { prisma } from "@/app/api/infra/data/prisma"

type TargetUser = {
  email: string
  oldSupabaseId?: string
  fullName: string
  phone?: string
  cpfCnpj?: string
}

const PASSWORD = "Corretor@2025"

const BRUNO = {
  profileId: "0c96a57e-6cc1-400f-bf3a-5740b699ac21",
  teamId: "8ea5fdc2-fac4-4ae8-a08e-914e6b0a2009",
}

const TARGETS: TargetUser[] = [
  {
    email: "karenleitecorreiadasilva@gmail.com",
    oldSupabaseId: "1039993f-b72a-427b-bfe5-45172f05e155",
    fullName: "Karen Leite",
    phone: "11940884923",
    cpfCnpj: "79072603028",
  },
  {
    email: "henriquecunhasilva813@gmail.com",
    oldSupabaseId: "440fb876-d858-4c0b-b880-9db229aa7f04",
    fullName: "Henrique Cunha",
    phone: "1151927740",
    cpfCnpj: "99892746066",
  },
]

function getArg(flag: string): boolean {
  return process.argv.includes(flag)
}

function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY"
    )
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function findAuthUserIdByEmail(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  email: string
): Promise<string | null> {
  // Supabase Admin API doesn't provide direct "get by email" helper; we scan.
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data.users ?? []
    const match = users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match?.id) return match.id
    if (users.length < perPage) return null
    page += 1
  }
}

async function deleteUserEverywhere(opts: {
  supabase: ReturnType<typeof createSupabaseAdminClient>
  email: string
  supabaseIdHint?: string
  dryRun: boolean
}) {
  const { supabase, email, supabaseIdHint, dryRun } = opts

  // 1) Delete Profile (and cascading data) from DB
  const profile = await prisma.profile.findFirst({
    where: {
      OR: [
        { email },
        ...(supabaseIdHint ? [{ supabaseId: supabaseIdHint }] : []),
      ],
    },
    select: { id: true, email: true, supabaseId: true, managerId: true, isMaster: true },
  })

  if (profile) {
    // If profile has dependents via managerId, deletion may fail due to Restrict.
    const children = await prisma.profile.count({ where: { managerId: profile.id } })
    if (children > 0) {
      throw new Error(
        `Cannot delete profile ${profile.email} (${profile.id}) because it has ${children} dependent profiles (profiles.managerId -> onDelete: Restrict).`
      )
    }

    if (!dryRun) {
      await prisma.profile.delete({ where: { id: profile.id } })
    }
  }

  // 2) Delete Auth user from Supabase
  let authUserId: string | null = null
  if (supabaseIdHint) {
    const { data } = await supabase.auth.admin.getUserById(supabaseIdHint)
    authUserId = data?.user?.id ?? null
  }
  if (!authUserId) {
    authUserId = await findAuthUserIdByEmail(supabase, email)
  }

  if (authUserId && !dryRun) {
    const { error } = await supabase.auth.admin.deleteUser(authUserId)
    if (error) {
      // If already deleted, keep going.
      if (error.status !== 404) throw error
    }
  }

  return { deletedProfile: !!profile, deletedAuthUser: !!authUserId }
}

async function recreateAndAttachToTeam(opts: {
  supabase: ReturnType<typeof createSupabaseAdminClient>
  target: TargetUser
  dryRun: boolean
}) {
  const { supabase, target, dryRun } = opts

  if (dryRun) {
    return { newSupabaseId: "DRY_RUN", newProfileId: "DRY_RUN" }
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: target.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: target.fullName },
    app_metadata: { provider: "email" },
  })

  if (createError || !created.user?.id) {
    // Keep error messages understandable.
    const msg = createError?.message || "Failed to create Supabase auth user"
    throw new Error(msg)
  }

  const newSupabaseId = created.user.id

  const profile = await prisma.profile.create({
    data: {
      supabaseId: newSupabaseId,
      email: target.email,
      fullName: target.fullName,
      phone: target.phone ?? null,
      cpfCnpj: target.cpfCnpj ?? null,
      role: "manager",
      functions: ["SDR", "CLOSER"],
      isMaster: false,
      managerId: BRUNO.profileId,
      activeTeamId: BRUNO.teamId,
    },
    select: { id: true },
  })

  await prisma.teamMember.create({
    data: {
      teamId: BRUNO.teamId,
      profileId: profile.id,
      role: "manager",
      functions: ["SDR", "CLOSER"],
    },
  })

  return { newSupabaseId, newProfileId: profile.id }
}

async function main() {
  const dryRun = getArg("--dry-run")
  const confirm = getArg("--confirm")

  if (!dryRun && !confirm) {
    console.error(
      "Refusing to run without confirmation. Re-run with --confirm (or --dry-run)."
    )
    process.exit(1)
  }

  const supabase = createSupabaseAdminClient()

  console.info("[reset-users] START", { dryRun })
  console.info("[reset-users] Target team:", BRUNO.teamId, "master:", BRUNO.profileId)

  for (const target of TARGETS) {
    console.info("[reset-users] Processing:", target.email)

    const deleted = await deleteUserEverywhere({
      supabase,
      email: target.email,
      supabaseIdHint: target.oldSupabaseId,
      dryRun,
    })

    console.info("[reset-users] Deleted:", deleted)

    const recreated = await recreateAndAttachToTeam({ supabase, target, dryRun })
    console.info("[reset-users] Recreated:", recreated)
  }

  console.info("[reset-users] DONE")
}

main()
  .catch((err) => {
    console.error("[reset-users] FAILED:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null)
  })

