import { describe, expect, it } from "bun:test"
import {
  planDuplicateEmailProfileMerges,
  type DuplicateEmailGroup,
} from "@/lib/radar/backfill-merge-duplicate-email-profiles-planner"

/**
 * Bug 2026-09-03 (caso PIMENTAS/KKJ): 3.163 pares de perfis duplicados no
 * padrão exato "mesmo time + mesmo e-mail + mesmo nome, um com telefone e um
 * sem" — produzido pela lacuna corrigida em `resolveProfileForPhone`/
 * `resolveProfileForEmail`. Este planner decide, por grupo já agrupado pela
 * consulta SQL (`teamId + normalizedPrimaryEmail + normalizedName`), quem é o
 * par seguro de fundir e quem foge do padrão (pula e conta o motivo — nunca
 * funde no escuro).
 */

function group(overrides: Partial<DuplicateEmailGroup>): DuplicateEmailGroup {
  return {
    teamId: "team-1",
    normalizedPrimaryEmail: "matriz@idgt.org.br",
    normalizedName: "pimentas beta",
    profiles: [],
    ...overrides,
  }
}

describe("planDuplicateEmailProfileMerges", () => {
  it("par exato (um com telefone, um sem) → funde, vencedor é o que tem telefone", () => {
    const plan = planDuplicateEmailProfileMerges([
      group({
        profiles: [
          { id: "profile-com-telefone", normalizedPhone: "5512988821371", createdAt: new Date("2026-09-01T17:22:00Z") },
          { id: "profile-sem-telefone", normalizedPhone: null, createdAt: new Date("2026-09-01T17:31:00Z") },
        ],
      }),
    ])

    expect(plan.items).toEqual([
      {
        teamId: "team-1",
        normalizedPrimaryEmail: "matriz@idgt.org.br",
        normalizedName: "pimentas beta",
        winningProfileId: "profile-com-telefone",
        losingProfileId: "profile-sem-telefone",
      },
    ])
    expect(plan.skipped).toEqual([])
  })

  it("par exato com ordem invertida (telefone é o segundo da lista) → ainda identifica o vencedor certo", () => {
    const plan = planDuplicateEmailProfileMerges([
      group({
        profiles: [
          { id: "profile-sem-telefone", normalizedPhone: null, createdAt: new Date("2026-09-01T17:31:00Z") },
          { id: "profile-com-telefone", normalizedPhone: "5512988821371", createdAt: new Date("2026-09-01T17:22:00Z") },
        ],
      }),
    ])

    expect(plan.items[0]?.winningProfileId).toBe("profile-com-telefone")
    expect(plan.items[0]?.losingProfileId).toBe("profile-sem-telefone")
  })

  it("trio (3 perfis no mesmo grupo) → pula, conta 'nao_e_par'", () => {
    const plan = planDuplicateEmailProfileMerges([
      group({
        profiles: [
          { id: "p1", normalizedPhone: "551100000001", createdAt: new Date() },
          { id: "p2", normalizedPhone: null, createdAt: new Date() },
          { id: "p3", normalizedPhone: null, createdAt: new Date() },
        ],
      }),
    ])

    expect(plan.items).toEqual([])
    expect(plan.skipped).toEqual([
      {
        teamId: "team-1",
        normalizedPrimaryEmail: "matriz@idgt.org.br",
        normalizedName: "pimentas beta",
        reason: "nao_e_par",
        profileCount: 3,
      },
    ])
  })

  it("par onde NENHUM dos dois tem telefone → pula, conta 'nenhum_tem_telefone' (não é o padrão do bug, sem sinal para decidir vencedor)", () => {
    const plan = planDuplicateEmailProfileMerges([
      group({
        profiles: [
          { id: "p1", normalizedPhone: null, createdAt: new Date() },
          { id: "p2", normalizedPhone: null, createdAt: new Date() },
        ],
      }),
    ])

    expect(plan.items).toEqual([])
    expect(plan.skipped[0]?.reason).toBe("nenhum_tem_telefone")
  })

  it("par onde AMBOS têm telefone (nomes coincidentes mas telefones diferentes) → pula, conta 'ambos_tem_telefone'", () => {
    const plan = planDuplicateEmailProfileMerges([
      group({
        profiles: [
          { id: "p1", normalizedPhone: "551100000001", createdAt: new Date() },
          { id: "p2", normalizedPhone: "551100000002", createdAt: new Date() },
        ],
      }),
    ])

    expect(plan.items).toEqual([])
    expect(plan.skipped[0]?.reason).toBe("ambos_tem_telefone")
  })

  it("múltiplos grupos → soma corretamente itens e pulados de cada um", () => {
    const plan = planDuplicateEmailProfileMerges([
      group({
        normalizedPrimaryEmail: "a@example.com",
        profiles: [
          { id: "a1", normalizedPhone: "5511900000001", createdAt: new Date() },
          { id: "a2", normalizedPhone: null, createdAt: new Date() },
        ],
      }),
      group({
        normalizedPrimaryEmail: "b@example.com",
        profiles: [
          { id: "b1", normalizedPhone: "5511900000002", createdAt: new Date() },
          { id: "b2", normalizedPhone: "5511900000003", createdAt: new Date() },
        ],
      }),
    ])

    expect(plan.items).toHaveLength(1)
    expect(plan.items[0]?.winningProfileId).toBe("a1")
    expect(plan.skipped).toHaveLength(1)
    expect(plan.skipped[0]?.reason).toBe("ambos_tem_telefone")
  })

  it("nenhum grupo → plano vazio", () => {
    const plan = planDuplicateEmailProfileMerges([])
    expect(plan).toEqual({ items: [], skipped: [] })
  })
})
