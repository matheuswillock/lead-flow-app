import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireTeamWebhooksLock, releaseTeamWebhooksLock } from "./team-webhooks-lock";

const roots: string[] = [];
function lockDir(): string {
  const root = mkdtempSync(join(tmpdir(), "lf-lock-test-"));
  roots.push(root);
  return join(root, "lock");
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("team-webhooks-lock", () => {
  it("o primeiro a chegar fica com o lock e o segundo espera a liberação", async () => {
    const dir = lockDir();
    await acquireTeamWebhooksLock({ dir });

    let sleeps = 0;
    const second = acquireTeamWebhooksLock({
      dir,
      pollMs: 1,
      sleep: async () => {
        sleeps += 1;
        if (sleeps === 3) releaseTeamWebhooksLock({ dir });
      },
    });
    await second;

    expect(sleeps).toBe(3);
    expect(existsSync(dir)).toBe(true);
  });

  it("descarta o lock de um worker que morreu (mais velho que o limite)", async () => {
    const dir = lockDir();
    mkdirSync(dir);
    const old = new Date(Date.now() - 20 * 60_000);
    utimesSync(dir, old, old);

    await acquireTeamWebhooksLock({ dir, staleAfterMs: 60_000 });

    expect(existsSync(dir)).toBe(true);
  });

  it("falha com mensagem clara quando o lock não libera dentro do prazo", async () => {
    const dir = lockDir();
    await acquireTeamWebhooksLock({ dir });
    let clock = 0;

    await expect(
      acquireTeamWebhooksLock({ dir, timeoutMs: 100, now: () => (clock += 60), sleep: async () => undefined, staleAfterMs: 10 ** 12 }),
    ).rejects.toThrow(/não liberou/);
  });

  it("liberar sem lock não falha", () => {
    expect(() => releaseTeamWebhooksLock({ dir: lockDir() })).not.toThrow();
  });
});
