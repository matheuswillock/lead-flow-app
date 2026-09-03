import { describe, expect, it } from "bun:test"
import {
  decideEmailProfileMatch,
  pickCompatibleEmailColumnCandidate,
} from "@/lib/radar/email-profile-match"

/**
 * Caso PIMENTAS/KKJ (bug 2026-09-03): `resolveProfileForEmail` só olhava a
 * `RadarIdentity` exclusiva do e-mail — perfis criados via
 * `resolveProfileForPhone` (import de base, carteira) ficavam com
 * `normalizedPrimaryEmail` preenchido na COLUNA mas sem a claim exclusiva, e
 * um contato de e-mail chegando depois nunca encontrava o dono e criava um
 * segundo perfil. Este planner decide, quando o fallback por coluna encontra
 * um candidato SEM claim exclusiva, se o contato deve ENRIQUECER esse perfil
 * (mesma pessoa) ou ganhar um perfil separado (guarda de e-mail compartilhado
 * — ex.: contato@empresa usado por pessoas diferentes).
 */
describe("decideEmailProfileMatch", () => {
  it("nome do candidato igual ao do contato → enriquece (caso PIMENTAS)", () => {
    const decision = decideEmailProfileMatch({
      candidate: {
        displayName: "PIMENTAS BETA",
        normalizedName: "pimentas beta",
        normalizedPhone: "5512988821371",
      },
      incomingNormalizedName: "pimentas beta",
    })
    expect(decision.action).toBe("enrich")
  })

  it("candidato sem nome usável (placeholder de e-mail) → enriquece mesmo com nome novo", () => {
    const decision = decideEmailProfileMatch({
      candidate: {
        displayName: "matriz@idgt.org.br",
        normalizedName: "matriz@idgt.org.br",
        normalizedPhone: null,
      },
      incomingNormalizedName: "pimentas beta",
    })
    expect(decision.action).toBe("enrich")
  })

  it("candidato rotulado 'Visitante Anônimo' → enriquece mesmo com nome novo", () => {
    const decision = decideEmailProfileMatch({
      candidate: { displayName: "Visitante Anônimo", normalizedName: "visitante anonimo", normalizedPhone: null },
      incomingNormalizedName: "pimentas beta",
    })
    expect(decision.action).toBe("enrich")
  })

  it("contato sem nome (incomingNormalizedName null) → enriquece (nada para divergir)", () => {
    const decision = decideEmailProfileMatch({
      candidate: { displayName: "Maria Silva", normalizedName: "maria silva", normalizedPhone: "5511988887777" },
      incomingNormalizedName: null,
    })
    expect(decision.action).toBe("enrich")
  })

  it("nome diverge mas candidato NÃO tem telefone próprio → enriquece (pode ser o mesmo perfil email-only ainda incompleto)", () => {
    const decision = decideEmailProfileMatch({
      candidate: { displayName: "Maria Silva", normalizedName: "maria silva", normalizedPhone: null },
      incomingNormalizedName: "joao pereira",
    })
    expect(decision.action).toBe("enrich")
  })

  it("guarda de e-mail compartilhado: nome diverge E candidato tem telefone próprio → cria separado", () => {
    const decision = decideEmailProfileMatch({
      candidate: { displayName: "Maria Silva", normalizedName: "maria silva", normalizedPhone: "5511988887777" },
      incomingNormalizedName: "joao pereira",
    })
    expect(decision).toEqual({ action: "create_separate", reason: "shared_email_different_person" })
  })
})

describe("pickCompatibleEmailColumnCandidate", () => {
  const mariaDivergente = {
    id: "profile-maria",
    displayName: "Maria Silva",
    normalizedName: "maria silva",
    normalizedPhone: "5511988887777",
  }
  const joaoMesmoNome = {
    id: "profile-joao",
    displayName: "João Pereira",
    normalizedName: "joao pereira",
    normalizedPhone: "5511977776666",
  }
  const emailOnlyPlaceholder = {
    id: "profile-placeholder",
    displayName: "matriz@idgt.org.br",
    normalizedName: "matriz@idgt.org.br",
    normalizedPhone: null,
  }

  it("achado codex #1155 (P2): candidato mais antigo divergente NÃO bloqueia — devolve o de nome idêntico mais adiante na fila", () => {
    expect(pickCompatibleEmailColumnCandidate([mariaDivergente, joaoMesmoNome], "joao pereira")).toBe(
      joaoMesmoNome
    )
  })

  it("sem nome idêntico, devolve o primeiro candidato ENRIQUECÍVEL pela guarda (placeholder/anônimo)", () => {
    expect(
      pickCompatibleEmailColumnCandidate([mariaDivergente, emailOnlyPlaceholder], "joao pereira")
    ).toBe(emailOnlyPlaceholder)
  })

  it("todos os candidatos são pessoas estabelecidas divergentes → null (chamador cria separado)", () => {
    expect(pickCompatibleEmailColumnCandidate([mariaDivergente], "joao pereira")).toBeNull()
  })

  it("nome idêntico vence mesmo quando um enriquecível vem antes na fila (identidade mais forte)", () => {
    expect(
      pickCompatibleEmailColumnCandidate([emailOnlyPlaceholder, joaoMesmoNome], "joao pereira")
    ).toBe(joaoMesmoNome)
  })

  it("lista vazia → null", () => {
    expect(pickCompatibleEmailColumnCandidate([], "joao pereira")).toBeNull()
  })
})
