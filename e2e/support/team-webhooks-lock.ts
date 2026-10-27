import { mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Exclusão mútua entre specs que contam ou criam webhooks no time E2E compartilhado.
 *
 * A suíte roda com `fullyParallel` e 2 workers na CI. Specs como `webhooks.spec.ts` afirmam contadores
 * exatos ("1 configurado · 1 ativo") sobre o time E2E, e outras criam webhooks nesse mesmo time:
 * rodando ao mesmo tempo, os números mudam no meio do teste. O lock faz essas specs rodarem uma por vez,
 * entre processos, sem mexer na paralelização do resto da suíte.
 *
 * `mkdir` é atômico: quem cria a pasta tem o lock. Lock com mais de `staleAfterMs` é de um worker que
 * morreu e é descartado.
 */
export type TeamWebhooksLockOptions = {
  dir?: string;
  staleAfterMs?: number;
  pollMs?: number;
  timeoutMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_DIR = join(tmpdir(), "lead-flow-e2e-team-webhooks.lock");
const DEFAULT_STALE_MS = 8 * 60_000;
const DEFAULT_POLL_MS = 500;
const DEFAULT_TIMEOUT_MS = 10 * 60_000;

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isStale(dir: string, staleAfterMs: number, now: number): boolean {
  try {
    return now - statSync(dir).mtimeMs > staleAfterMs;
  } catch {
    return false;
  }
}

export async function acquireTeamWebhooksLock(options: TeamWebhooksLockOptions = {}): Promise<void> {
  const dir = options.dir ?? DEFAULT_DIR;
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_MS;
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? realSleep;
  const startedAt = now();

  for (;;) {
    try {
      mkdirSync(dir);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    if (isStale(dir, staleAfterMs, now())) {
      rmSync(dir, { recursive: true, force: true });
      continue;
    }
    if (now() - startedAt > timeoutMs) {
      throw new Error(`Lock de webhooks do time E2E não liberou em ${timeoutMs} ms (${dir}).`);
    }
    await sleep(pollMs);
  }
}

export function releaseTeamWebhooksLock(options: Pick<TeamWebhooksLockOptions, "dir"> = {}): void {
  rmSync(options.dir ?? DEFAULT_DIR, { recursive: true, force: true });
}
