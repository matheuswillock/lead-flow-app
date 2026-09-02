import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"

/**
 * T-20.1 e T-20.4 de [[20 — Assinaturas — Backend]] E1 (DA1/C9/C10/S4/C3).
 *
 * Prova o motivo de existir da coluna `profileId` SEM relation FK: o snapshot
 * de auditoria MUST sobreviver ao hard-delete do profile que ele descreve —
 * é o oposto do design do PR #902 (onDelete: Restrict), que forçava cleanup
 * manual em todo call-site de deleção e apagava o próprio backup no evento
 * destrutivo que deveria auditar. Roda contra Postgres real: o comportamento
 * em teste é literalmente "o Postgres deixa a FK impedir isso ou não" — um
 * mock não prova nada sobre a ausência de uma constraint.
 *
 * Controle negativo (executado manualmente, não fica no código): reintroduzir
 * `profile Profile @relation(fields: [profileId], references: [id], onDelete: Restrict)`
 * no model SubscriptionStateSnapshot, rodar `bunx prisma generate` +
 * `bun run db:migrate:from-prisma -- --dry-run`, e confirmar que este teste
 * vira P2003 (FK violation) — depois reverter e conferir `git diff` limpo.
 */
const RUN_INTEGRATION =
  process.env.SNAPSHOT_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

let prisma: typeof import("@/app/api/infra/data/prisma").prisma

if (RUN_INTEGRATION) {
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
}

const scope = { profileId: "" }

describe.skipIf(!RUN_INTEGRATION)("SubscriptionStateSnapshot — append-only (T-20.1)", () => {
  beforeAll(async () => {
    const profile = await prisma.profile.create({
      data: {
        email: `spec20-e1-snapshot-${randomUUID()}@example.test`,
        isMaster: true,
      },
      select: { id: true },
    })
    scope.profileId = profile.id
  })

  afterAll(async () => {
    // O profile já foi hard-deletado pelo próprio teste; nada a limpar nele.
    // O snapshot é append-only por trigger — não há como (nem deve) apagar
    // aqui; fica como resíduo de auditoria esperado no Postgres local.
  })

  it("sobrevive ao hard-delete do profile (sem FK, DA1)", async () => {
    const snapshot = await prisma.subscriptionStateSnapshot.create({
      data: {
        profileId: scope.profileId,
        schemaVersion: "1",
        payload: { profile: { id: scope.profileId, email: "frozen@example.test" } },
      },
    })

    await prisma.profile.delete({ where: { id: scope.profileId } })

    const survived = await prisma.subscriptionStateSnapshot.findUnique({
      where: { id: snapshot.id },
    })

    expect(survived).not.toBeNull()
    expect(survived?.profileId).toBe(scope.profileId)
  })

  it("UPDATE e DELETE são bloqueados por trigger (S4/C3)", async () => {
    const snapshot = await prisma.subscriptionStateSnapshot.create({
      data: {
        profileId: randomUUID(),
        schemaVersion: "1",
        payload: { x: 1 },
      },
    })

    let updateThrew = false
    try {
      await prisma.subscriptionStateSnapshot.update({
        where: { id: snapshot.id },
        data: { schemaVersion: "2" },
      })
    } catch {
      updateThrew = true
    }
    expect(updateThrew).toBe(true)

    let deleteThrew = false
    try {
      await prisma.subscriptionStateSnapshot.delete({ where: { id: snapshot.id } })
    } catch {
      deleteThrew = true
    }
    expect(deleteThrew).toBe(true)
  })
})
