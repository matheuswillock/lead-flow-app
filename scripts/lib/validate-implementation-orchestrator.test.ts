import { describe, expect, it } from "bun:test";
import {
  summarizeResults,
  validateImplementation,
  type StepRunner,
  type ValidateStep,
  type ValidateStepResult,
} from "./validate-implementation-orchestrator";

function makeRunner(results: Record<string, number>, calls: string[]): StepRunner {
  return async (step: ValidateStep): Promise<ValidateStepResult> => {
    calls.push(step.name);
    return { name: step.name, exitCode: results[step.name] ?? 0, durationMs: 0, output: "" };
  };
}

describe("validateImplementation", () => {
  it("fail-fast: falha na fase 1 aborta sem rodar a fase 2 nem o resto da fase 1", async () => {
    const calls: string[] = [];
    const outcome = await validateImplementation({
      fastSteps: [
        { name: "governance:check", cmd: "bun", args: ["run", "governance:check"] },
        { name: "lint:pt-br:strict", cmd: "bun", args: ["run", "lint:pt-br:strict"] },
      ],
      parallelSteps: [{ name: "lint", cmd: "bun", args: ["run", "lint"] }],
      run: makeRunner({ "governance:check": 2 }, calls),
    });

    expect(calls).toEqual(["governance:check"]);
    expect(outcome.ok).toBe(false);
    expect(outcome.failedPhase).toBe("fast");
    expect(outcome.failedStepNames).toEqual(["governance:check"]);
    expect(outcome.exitCode).toBe(2);
    expect(outcome.parallelResults).toEqual([]);
  });

  it("fase 2: um falhou entre resultados paralelos reprova com exit 1", async () => {
    const calls: string[] = [];
    const outcome = await validateImplementation({
      fastSteps: [{ name: "governance:check", cmd: "bun", args: ["run", "governance:check"] }],
      parallelSteps: [
        { name: "lint", cmd: "bun", args: ["run", "lint"] },
        { name: "typecheck", cmd: "bun", args: ["run", "typecheck"] },
        { name: "test", cmd: "bun", args: ["run", "test"] },
      ],
      run: makeRunner({ typecheck: 1 }, calls),
    });

    expect(calls).toEqual(["governance:check", "lint", "typecheck", "test"]);
    expect(outcome.ok).toBe(false);
    expect(outcome.failedPhase).toBe("parallel");
    expect(outcome.failedStepNames).toEqual(["typecheck"]);
    expect(outcome.exitCode).toBe(1);
  });

  it("fase 2: todos OK aprova com exit 0", async () => {
    const calls: string[] = [];
    const outcome = await validateImplementation({
      fastSteps: [{ name: "governance:check", cmd: "bun", args: ["run", "governance:check"] }],
      parallelSteps: [
        { name: "lint", cmd: "bun", args: ["run", "lint"] },
        { name: "typecheck", cmd: "bun", args: ["run", "typecheck"] },
      ],
      run: makeRunner({}, calls),
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.failedPhase).toBeNull();
    expect(outcome.failedStepNames).toEqual([]);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.fastResults).toHaveLength(1);
    expect(outcome.parallelResults).toHaveLength(2);
  });
});

describe("summarizeResults", () => {
  it("agrega nomes reprovados e reprova quando há qualquer falha", async () => {
    const summary = summarizeResults([
      { name: "lint", exitCode: 0, durationMs: 0, output: "" },
      { name: "test", exitCode: 1, durationMs: 0, output: "" },
    ]);

    expect(summary).toEqual({ ok: false, failedNames: ["test"] });
  });
});
