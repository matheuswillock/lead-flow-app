import { describe, expect, it } from "bun:test"
import {
  EMAIL_LOG_STATUS_FILTER_OPTIONS,
  resolveEmailLogStatusBadge,
} from "./email-log-status-badge"

describe("resolveEmailLogStatusBadge", () => {
  it("resolve os status conhecidos com rótulo em pt-BR", () => {
    expect(resolveEmailLogStatusBadge("sent").label).toBe("Enviado")
    expect(resolveEmailLogStatusBadge("bounced").label).toBe("Bounce")
    expect(resolveEmailLogStatusBadge("failed").label).toBe("Falhou")
  })

  it("resolve `suppressed`, gravado desde a pré-validação de audiência", () => {
    // Regressão: `suppressed` passou a ser gravado sem entrar nos mapas da UI.
    // `STATUS_CONFIG[log.status]` vinha `undefined` e o acesso a `.className`
    // derrubava a aba de Logs da campanha e a página de Histórico inteiras —
    // inclusive os logs enviados com sucesso ficavam inacessíveis.
    const badge = resolveEmailLogStatusBadge("suppressed")
    expect(badge.label).toBe("Recusado")
    expect(badge.className).toContain("semantic")
  })

  it("nunca devolve undefined para status desconhecido", () => {
    // O status vem do banco, não do tipo. Um enum novo no schema não pode
    // derrubar a página antes de alguém lembrar de atualizar o mapa.
    const badge = resolveEmailLogStatusBadge("status_que_ainda_nao_existe")
    expect(badge).toBeDefined()
    expect(typeof badge.label).toBe("string")
    expect(badge.label.length).toBeGreaterThan(0)
    expect(typeof badge.className).toBe("string")
  })

  it("não vaza o valor cru em inglês como rótulo de UI", () => {
    expect(resolveEmailLogStatusBadge("suppressed").label).not.toBe("suppressed")
  })

  it("o filtro de status oferece todos os status que a UI sabe renderizar", () => {
    const comFiltro = new Set(EMAIL_LOG_STATUS_FILTER_OPTIONS.map((option) => option.value))
    expect(comFiltro.has("suppressed")).toBe(true)
    for (const option of EMAIL_LOG_STATUS_FILTER_OPTIONS) {
      expect(resolveEmailLogStatusBadge(option.value).label).toBe(option.label)
    }
  })
})
