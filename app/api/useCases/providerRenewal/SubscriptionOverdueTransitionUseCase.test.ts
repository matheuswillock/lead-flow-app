import { describe, expect, it } from "bun:test";
import {
  SubscriptionOverdueTransitionUseCase,
  type RouterSubscriptionOverdueSource,
  type SubscriptionOverdueTransitionSummary,
} from "./SubscriptionOverdueTransitionUseCase";

// Meio-dia em São Paulo de 10/12/2026: "hoje" é 10/12 para a regra de vencimento.
const NOW = new Date("2026-12-10T15:00:00.000Z");
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

type Row = { profileId: string; dueDate: Date };

function build(rows: Row[], options: { batchSize?: number; markResult?: (profileId: string) => boolean | Error } = {}) {
  const marked: string[] = [];
  const recorded: string[] = [];
  const windows: Array<{ dueSince: Date; dueUntil: Date }> = [];
  const source: RouterSubscriptionOverdueSource = {
    async listActiveRouterSubscriptionsDueBetween(input) {
      windows.push({ dueSince: input.dueSince, dueUntil: input.dueUntil });
      return rows
        .filter((row) => !input.afterProfileId || row.profileId > input.afterProfileId)
        .sort((a, b) => a.profileId.localeCompare(b.profileId))
        .slice(0, input.limit);
    },
    async markPastDueIfStillDue(profileId) {
      const result = options.markResult?.(profileId) ?? true;
      if (result instanceof Error) throw result;
      if (result) marked.push(profileId);
      return result;
    },
  };
  const useCase = new SubscriptionOverdueTransitionUseCase({
    source,
    graceDays: 5,
    batchSize: options.batchSize,
    recordTransition: async (profileId) => {
      recorded.push(profileId);
    },
  });
  return { useCase, marked, recorded, windows };
}

const summaryOf = (output: { result?: unknown }) => output.result as SubscriptionOverdueTransitionSummary;

describe("SubscriptionOverdueTransitionUseCase", () => {
  it("marca como em atraso a conta cujo vencimento já passou e registra na linha do tempo", async () => {
    const { useCase, marked, recorded } = build([{ profileId: "p1", dueDate: day("2026-12-09") }]);

    const output = await useCase.execute(NOW);

    expect(output.isValid).toBe(true);
    expect(marked).toEqual(["p1"]);
    expect(recorded).toEqual(["p1"]);
    expect(summaryOf(output)).toEqual({ transitioned: 1, skipped: 0, failed: 0 });
  });

  it("quem vence hoje ainda está em dia e não é marcado", async () => {
    const { useCase, marked } = build([{ profileId: "p1", dueDate: day("2026-12-10") }]);

    const output = await useCase.execute(NOW);

    expect(marked).toHaveLength(0);
    expect(summaryOf(output)).toMatchObject({ transitioned: 0, skipped: 1 });
  });

  it("consulta só a janela da carência (vencidas há mais que isso já estão bloqueadas)", async () => {
    const { useCase, windows } = build([]);

    await useCase.execute(NOW);

    expect(windows[0].dueUntil).toEqual(NOW);
    expect(windows[0].dueSince).toEqual(new Date("2026-12-05T15:00:00.000Z"));
  });

  it("conta que pagou no meio do caminho não é revertida nem registrada", async () => {
    const { useCase, recorded } = build([{ profileId: "p1", dueDate: day("2026-12-09") }], { markResult: () => false });

    const output = await useCase.execute(NOW);

    expect(recorded).toHaveLength(0);
    expect(summaryOf(output)).toEqual({ transitioned: 0, skipped: 1, failed: 0 });
  });

  it("falha de uma conta não interrompe as outras e deixa o resultado inválido", async () => {
    const { useCase, marked } = build(
      [
        { profileId: "p1", dueDate: day("2026-12-09") },
        { profileId: "p2", dueDate: day("2026-12-08") },
      ],
      { markResult: (profileId) => (profileId === "p1" ? new Error("db fora") : true) },
    );

    const output = await useCase.execute(NOW);

    expect(output.isValid).toBe(false);
    expect(marked).toEqual(["p2"]);
    expect(summaryOf(output)).toEqual({ transitioned: 1, skipped: 0, failed: 1 });
  });

  it("percorre todas as páginas da janela", async () => {
    const rows = ["p1", "p2", "p3", "p4", "p5"].map((profileId) => ({ profileId, dueDate: day("2026-12-09") }));
    const { useCase, marked } = build(rows, { batchSize: 2 });

    const output = await useCase.execute(NOW);

    expect(marked).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(summaryOf(output).transitioned).toBe(5);
  });

  it("rodar de novo no mesmo dia não marca ninguém duas vezes", async () => {
    const seen = new Set<string>();
    const { useCase } = build([{ profileId: "p1", dueDate: day("2026-12-09") }], {
      markResult: (profileId) => {
        if (seen.has(profileId)) return false;
        seen.add(profileId);
        return true;
      },
    });

    const first = await useCase.execute(NOW);
    const second = await useCase.execute(NOW);

    expect(summaryOf(first).transitioned).toBe(1);
    expect(summaryOf(second)).toEqual({ transitioned: 0, skipped: 1, failed: 0 });
  });
});
