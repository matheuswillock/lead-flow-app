import fs from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function nowIso() {
  return new Date().toISOString()
}

function appendLog(logPath: string, line: string) {
  fs.appendFileSync(logPath, `[${nowIso()}] ${line}\n`, "utf-8")
}

async function main() {
  const root = process.cwd()
  const logPath = path.join(root, "scripts", "backfill-teams.log")
  const errorsPath = path.join(root, "scripts", "backfill-teams.errors.log")

  fs.mkdirSync(path.join(root, "scripts"), { recursive: true })
  fs.writeFileSync(errorsPath, `-- backfill-teams.errors.log\n-- startedAt: ${nowIso()}\n\n`, "utf-8")

  appendLog(logPath, `--- START backfill-teams ---`)
  console.info(`[backfill-teams] START`)
  console.info(`[backfill-teams] Log: ${path.relative(root, logPath)}`)
  console.info(`[backfill-teams] Errors: ${path.relative(root, errorsPath)}`)

  try {
    // IMPORTANTE:
    // - Usamos interactive transaction pra garantir MESMA conexão (TEMP TABLE depende disso)
    // - Se qualquer etapa falhar, rollback automático
    await prisma.$transaction(
      async (tx) => {
        // 0) garantir pgcrypto (pra gen_random_uuid)
        // (Se não tiver permissão, pode falhar — mas em Supabase geralmente é ok)
        try {
          await tx.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`)
        } catch (e: any) {
          // não falha aqui; só avisa
          const msg = `WARN: CREATE EXTENSION pgcrypto falhou (seguindo): ${e?.message ?? String(e)}`
          console.warn(msg)
          appendLog(logPath, msg)
        }

        // 1) Pré-checagens (falhar rápido se migrations não foram aplicadas)
        const precheckSql = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'teams'
  ) THEN
    RAISE EXCEPTION 'Tabela public.teams não existe. Rode as migrations Prisma primeiro.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'team_members'
  ) THEN
    RAISE EXCEPTION 'Tabela public.team_members não existe. Rode as migrations Prisma primeiro.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leads' AND column_name='teamId'
  ) THEN
    RAISE EXCEPTION 'Coluna public.leads.teamId não existe. Rode as migrations Prisma primeiro.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pending_operators' AND column_name='teamId'
  ) THEN
    RAISE EXCEPTION 'Coluna public.pending_operators.teamId não existe. Rode as migrations Prisma primeiro.';
  END IF;
END $$;
`
        appendLog(logPath, `STEP precheck: start`)
        await tx.$executeRawUnsafe(precheckSql)
        appendLog(logPath, `STEP precheck: ok`)

        // 2) Criar times default para cada masterId legado (managerId)
        const createDefaultTeamsSql = `
WITH masters AS (
  SELECT DISTINCT l."managerId" AS "masterId"
  FROM public."leads" l

  UNION
  SELECT DISTINCT po."managerId" AS "masterId"
  FROM public."pending_operators" po

  UNION
  SELECT p."id" AS "masterId"
  FROM public."profiles" p
  WHERE p."isMaster" = TRUE
),
to_create AS (
  SELECT
    m."masterId",
    COALESCE(NULLIF(p."fullName", ''), p."email", 'Time Padrão') AS "teamName"
  FROM masters m
  JOIN public."profiles" p ON p."id" = m."masterId"
  LEFT JOIN public."teams" t
    ON t."masterId" = m."masterId"
   AND t."isDefault" = TRUE
  WHERE t."id" IS NULL
)
INSERT INTO public."teams" ("id","name","masterId","isDefault","createdAt","updatedAt")
SELECT
  gen_random_uuid(),
  ('Time ' || tc."teamName")::text,
  tc."masterId",
  TRUE,
  now(),
  now()
FROM to_create tc;
`
        appendLog(logPath, `STEP create_default_teams: start`)
        const createdTeams = await tx.$executeRawUnsafe(createDefaultTeamsSql)
        appendLog(logPath, `STEP create_default_teams: ok affected=${String(createdTeams)}`)

        // 3) Tabela temporária masterId -> defaultTeamId
        const tmpTableSql = `
CREATE TEMP TABLE tmp_master_default_team AS
SELECT
  t."masterId",
  t."id" AS "teamId"
FROM public."teams" t
WHERE t."isDefault" = TRUE;
`
        appendLog(logPath, `STEP create_tmp_table: start`)
        await tx.$executeRawUnsafe(tmpTableSql)
        appendLog(logPath, `STEP create_tmp_table: ok`)

        // 4) Garantir master como membro do próprio time default (manager)
        const ensureMasterMemberSql = `
INSERT INTO public."team_members" ("id","teamId","profileId","role","functions","createdAt","updatedAt")
SELECT
  gen_random_uuid(),
  m."teamId",
  m."masterId",
  'manager'::"UserRole",
  ARRAY[]::"UserFunction"[],
  now(),
  now()
FROM tmp_master_default_team m
LEFT JOIN public."team_members" tm
  ON tm."teamId" = m."teamId"
 AND tm."profileId" = m."masterId"
WHERE tm."id" IS NULL;
`
        appendLog(logPath, `STEP ensure_master_member: start`)
        const ensuredMaster = await tx.$executeRawUnsafe(ensureMasterMemberSql)
        appendLog(logPath, `STEP ensure_master_member: ok affected=${String(ensuredMaster)}`)

        // 5) Migrar membros legados (profiles.managerId = master) para o time default do master
        const migrateMembersSql = `
INSERT INTO public."team_members" ("id","teamId","profileId","role","functions","createdAt","updatedAt")
SELECT
  gen_random_uuid(),
  m."teamId",
  p."id" AS "profileId",
  p."role",
  p."functions",
  now(),
  now()
FROM public."profiles" p
JOIN tmp_master_default_team m
  ON m."masterId" = p."managerId"
LEFT JOIN public."team_members" tm
  ON tm."teamId" = m."teamId"
 AND tm."profileId" = p."id"
WHERE p."managerId" IS NOT NULL
  AND tm."id" IS NULL;
`
        appendLog(logPath, `STEP migrate_team_members: start`)
        const migratedMembers = await tx.$executeRawUnsafe(migrateMembersSql)
        appendLog(logPath, `STEP migrate_team_members: ok affected=${String(migratedMembers)}`)

        // 6) Atualizar leads.teamId com defaultTeamId (managerId antigo)
        const updateLeadsSql = `
UPDATE public."leads" l
SET "teamId" = m."teamId"
FROM tmp_master_default_team m
WHERE l."managerId" = m."masterId"
  AND (l."teamId" IS NULL);
`
        appendLog(logPath, `STEP update_leads_teamId: start`)
        const updatedLeads = await tx.$executeRawUnsafe(updateLeadsSql)
        appendLog(logPath, `STEP update_leads_teamId: ok affected=${String(updatedLeads)}`)

        // 7) Atualizar pending_operators.teamId com defaultTeamId (managerId antigo)
        const updatePendingSql = `
UPDATE public."pending_operators" po
SET "teamId" = m."teamId"
FROM tmp_master_default_team m
WHERE po."managerId" = m."masterId"
  AND (po."teamId" IS NULL);
`
        appendLog(logPath, `STEP update_pending_operators_teamId: start`)
        const updatedPending = await tx.$executeRawUnsafe(updatePendingSql)
        appendLog(logPath, `STEP update_pending_operators_teamId: ok affected=${String(updatedPending)}`)

        // 7.1) (Opcional) Setar profiles.activeTeamId para o time default, se a coluna existir
        // O seu diagrama já mostra activeTeamId em profiles. :contentReference[oaicite:1]{index=1}
        const hasActiveTeamCol = await tx.$queryRawUnsafe<Array<{ exists: boolean }>>(`
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='profiles' AND column_name='activeTeamId'
) AS "exists";
`)
        if (hasActiveTeamCol?.[0]?.exists) {
          const updateActiveTeamSql = `
UPDATE public."profiles" p
SET "activeTeamId" = m."teamId"
FROM tmp_master_default_team m
WHERE (p."id" = m."masterId" OR p."managerId" = m."masterId")
  AND (p."activeTeamId" IS NULL);
`
          appendLog(logPath, `STEP update_profiles_activeTeamId: start`)
          const updatedProfiles = await tx.$executeRawUnsafe(updateActiveTeamSql)
          appendLog(logPath, `STEP update_profiles_activeTeamId: ok affected=${String(updatedProfiles)}`)
        } else {
          appendLog(logPath, `STEP update_profiles_activeTeamId: skip (column not found)`)
        }

        // 8) Sanity checks (counts)
        const missingLeads = await tx.$queryRawUnsafe<Array<{ count: number }>>(
          `SELECT COUNT(*)::int AS count FROM public."leads" WHERE "teamId" IS NULL;`
        )
        const missingPending = await tx.$queryRawUnsafe<Array<{ count: number }>>(
          `SELECT COUNT(*)::int AS count FROM public."pending_operators" WHERE "teamId" IS NULL;`
        )

        const missingLeadsCount = missingLeads?.[0]?.count ?? -1
        const missingPendingCount = missingPending?.[0]?.count ?? -1

        const sanityMsg = `SANITY leads_missing_teamId=${missingLeadsCount} pending_missing_teamId=${missingPendingCount}`
        console.info(`[backfill-teams] ${sanityMsg}`)
        appendLog(logPath, sanityMsg)

        // Se quiser ser mais rígido, descomente:
        // if (missingLeadsCount > 0 || missingPendingCount > 0) {
        //   throw new Error(`Sanity check failed: ${sanityMsg}`)
        // }
      },
      { timeout: 1000 * 60 * 10 } // 10 min
    )

    appendLog(logPath, `--- DONE backfill-teams OK ---`)
    console.info(`[backfill-teams] DONE OK`)
  } catch (err: any) {
    const msg = `FATAL: ${err?.message ?? String(err)}`
    console.error(`[backfill-teams] ${msg}`)
    appendLog(logPath, msg)
    fs.appendFileSync(errorsPath, `${msg}\n${err?.stack ?? ""}\n\n`, "utf-8")
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
