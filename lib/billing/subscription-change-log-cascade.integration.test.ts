import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"

/**
 * Achado P1 do Codex no PR #1138 ([[20 — Assinaturas — Backend]] E1,
 * migration 20260902122015). O trigger append-only criado em
 * 20260901233808 bloqueava INCONDICIONALMENTE update/delete em
 * corretor_studio_subscription_change_logs — inclusive quando disparado
 * pelas próprias ações de FK já existentes na tabela (ON DELETE CASCADE em
 * profileId, ON DELETE SET NULL em actorProfileId, migration 20260824011709),
 * o que travava a deleção de QUALQUER profile com histórico de assinatura.
 *
 * Roda contra Postgres real: a distinção "mutação veio de uma ação de FK
 * (pg_trigger_depth() > 1) vs. mutação direta" só existe de verdade dentro
 * do Postgres — um mock não prova nada sobre profundidade de trigger.
 *
 * Controle negativo (executado manualmente, não fica no código): reverter a
 * function `prevent_subscription_audit_mutation` para a versão incondicional
 * (sem o `if pg_trigger_depth() > 1`) direto no Postgres local, rodar este
 * arquivo e confirmar que "cascata de FK não deve lançar" fica vermelho
 * (profile.delete lança), depois reaplicar a migration 20260902122015 e
 * confirmar verde de novo.
 */
const RUN_INTEGRATION =
  process.env.SNAPSHOT_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

let prisma: typeof import("@/app/api/infra/data/prisma").prisma

if (RUN_INTEGRATION) {
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
}

describe.skipIf(!RUN_INTEGRATION)("SubscriptionChangeLog — append-only sem quebrar cascata de FK (E1)", () => {
  it("UPDATE e DELETE diretos continuam bloqueados (S4/C3)", async () => {
    const owner = await prisma.profile.create({
      data: { email: `spec20-e1-direct-owner-${randomUUID()}@example.test`, isMaster: true },
      select: { id: true },
    })

    const log = await prisma.subscriptionChangeLog.create({
      data: { profileId: owner.id, source: "test", changeType: "test_change" },
    })

    let updateThrew = false
    try {
      await prisma.subscriptionChangeLog.update({ where: { id: log.id }, data: { changeType: "tampered" } })
    } catch {
      updateThrew = true
    }
    expect(updateThrew).toBe(true)

    let deleteThrew = false
    try {
      await prisma.subscriptionChangeLog.delete({ where: { id: log.id } })
    } catch {
      deleteThrew = true
    }
    expect(deleteThrew).toBe(true)

    await prisma.profile.delete({ where: { id: owner.id } })
  })

  it("deletar o profile ATOR faz cascade SET NULL sem lançar (achado P1)", async () => {
    const actor = await prisma.profile.create({
      data: { email: `spec20-e1-actor-${randomUUID()}@example.test`, isMaster: true },
      select: { id: true },
    })
    const owner = await prisma.profile.create({
      data: { email: `spec20-e1-owner-for-actor-${randomUUID()}@example.test`, isMaster: true },
      select: { id: true },
    })
    const log = await prisma.subscriptionChangeLog.create({
      data: { profileId: owner.id, actorProfileId: actor.id, source: "test", changeType: "test_change" },
    })

    await prisma.profile.delete({ where: { id: actor.id } })

    const survived = await prisma.subscriptionChangeLog.findUnique({ where: { id: log.id } })
    expect(survived).not.toBeNull()
    expect(survived?.actorProfileId).toBeNull()

    await prisma.profile.delete({ where: { id: owner.id } })
  })

  it("deletar o profile DONO faz cascade DELETE do log sem lançar (achado P1)", async () => {
    const owner = await prisma.profile.create({
      data: { email: `spec20-e1-owner-cascade-${randomUUID()}@example.test`, isMaster: true },
      select: { id: true },
    })
    const log = await prisma.subscriptionChangeLog.create({
      data: { profileId: owner.id, source: "test", changeType: "test_change" },
    })

    await prisma.profile.delete({ where: { id: owner.id } })

    const survived = await prisma.subscriptionChangeLog.findUnique({ where: { id: log.id } })
    expect(survived).toBeNull()
  })
})
