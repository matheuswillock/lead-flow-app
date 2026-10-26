/**
 * Orquestração do `validate:implementation` em módulo testável.
 *
 * Fase 1 (serial, fail-fast): qualquer falha aborta antes dos checks
 * pesados. Fase 2 (paralela): `lint`, `typecheck` e `test` rodam juntos.
 *
 * Este módulo não executa subprocessos nem imprime nada: recebe um
 * `StepRunner` injetável e devolve um `ValidateOutcome` com o exit code
 * já resolvido. O script `scripts/validate-implementation.ts` injeta o
 * runner real (spawn) e cuida do log no console.
 */

export type ValidateStep = { name: string; cmd: string; args: string[] };

export type ValidateStepResult = {
  name: string;
  exitCode: number;
  durationMs: number;
  output: string;
};

export type StepRunner = (step: ValidateStep) => Promise<ValidateStepResult>;

export type ValidatePhase = "fast" | "parallel";

export type ValidateOutcome = {
  ok: boolean;
  fastResults: ValidateStepResult[];
  parallelResults: ValidateStepResult[];
  failedPhase: ValidatePhase | null;
  failedStepNames: string[];
  exitCode: number;
};

export function summarizeResults(results: ValidateStepResult[]): {
  ok: boolean;
  failedNames: string[];
} {
  const failedNames = results.filter((result) => result.exitCode !== 0).map((result) => result.name);
  return { ok: failedNames.length === 0, failedNames };
}

export async function validateImplementation(options: {
  fastSteps: ValidateStep[];
  parallelSteps: ValidateStep[];
  run: StepRunner;
}): Promise<ValidateOutcome> {
  const fastResults: ValidateStepResult[] = [];
  for (const step of options.fastSteps) {
    const result = await options.run(step);
    fastResults.push(result);
    if (result.exitCode !== 0) {
      return {
        ok: false,
        fastResults,
        parallelResults: [],
        failedPhase: "fast",
        failedStepNames: [result.name],
        exitCode: result.exitCode,
      };
    }
  }

  const parallelResults = await Promise.all(options.parallelSteps.map((step) => options.run(step)));
  const summary = summarizeResults(parallelResults);
  return {
    ok: summary.ok,
    fastResults,
    parallelResults,
    failedPhase: summary.ok ? null : "parallel",
    failedStepNames: summary.failedNames,
    exitCode: summary.ok ? 0 : 1,
  };
}
