import { describe, expect, it } from "bun:test"
import { selectFairDispatchBatch } from "./campaign-dispatch-fair-batch"

type Row = { id: string; teamId: string }

function row(id: string, teamId: string): Row {
  return { id, teamId }
}

describe("selectFairDispatchBatch", () => {
  it("um time no teto não monopoliza o lote: round-robin dá 1 slot por time por rodada", () => {
    // Cenário do achado (PR #1178): 5 partes vencidas do time A (no teto)
    // chegariam TODAS antes da única parte do time B com capacidade livre.
    const candidates = [
      row("a1", "team-a"),
      row("a2", "team-a"),
      row("a3", "team-a"),
      row("a4", "team-a"),
      row("a5", "team-a"),
      row("b1", "team-b"),
      row("c1", "team-c"),
    ]

    const selected = selectFairDispatchBatch(candidates, 5)

    // Rodada 1: a1 (A), b1 (B), c1 (C) — na ordem em que os times aparecem na
    // fila global. Rodada 2: a2. Rodada 3: a3.
    expect(selected.map((r) => r.id)).toEqual(["a1", "b1", "c1", "a2", "a3"])
  })

  it("preserva a ordem global intra-time (semântica do queuedAheadCount)", () => {
    const candidates = [
      row("a1", "team-a"),
      row("b1", "team-b"),
      row("a2", "team-a"),
      row("b2", "team-b"),
    ]

    const selected = selectFairDispatchBatch(candidates, 4)

    const teamAOrder = selected.filter((r) => r.teamId === "team-a").map((r) => r.id)
    const teamBOrder = selected.filter((r) => r.teamId === "team-b").map((r) => r.id)
    expect(teamAOrder).toEqual(["a1", "a2"])
    expect(teamBOrder).toEqual(["b1", "b2"])
  })

  it("time único degrada para a seleção antiga (mais antigas primeiro, até o teto do lote)", () => {
    const candidates = [row("a1", "t"), row("a2", "t"), row("a3", "t")]
    expect(selectFairDispatchBatch(candidates, 2).map((r) => r.id)).toEqual(["a1", "a2"])
  })

  it("menos candidatas que o lote devolve todas, sem repetição", () => {
    const candidates = [row("a1", "team-a"), row("b1", "team-b")]
    expect(selectFairDispatchBatch(candidates, 5).map((r) => r.id)).toEqual(["a1", "b1"])
  })

  it("lote zero ou candidatas vazias devolvem vazio", () => {
    expect(selectFairDispatchBatch([], 5)).toEqual([])
    expect(selectFairDispatchBatch([row("a1", "t")], 0)).toEqual([])
  })
})
