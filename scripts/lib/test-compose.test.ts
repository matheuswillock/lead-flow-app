import { describe, expect, it } from "bun:test";

import { main, runSuite, type ComposeDeps } from "../test-compose";
import {
  buildTestEnv,
  commandsForStage,
  downArgs,
  isStage,
  isSuite,
  runStage,
  runSuiteArgs,
  type Command,
} from "./test-compose";

function composeDeps(statusFor: (args: string[]) => number, keepStack = false) {
  const calls: string[][] = [];
  const logs: string[] = [];
  const deps: ComposeDeps = {
    podman: (args) => {
      calls.push(args);
      return statusFor(args);
    },
    log: (message) => logs.push(message),
    keepStack,
  };
  return { deps, calls, logs };
}

describe("validação de suíte e etapa", () => {
  it("aceita só nomes conhecidos", () => {
    expect(isSuite("e2e")).toBe(true);
    expect(isSuite("down")).toBe(false);
    expect(isSuite(undefined)).toBe(false);
    expect(isStage("app")).toBe(true);
    expect(isStage("build")).toBe(false);
  });
});

describe("argumentos do podman compose", () => {
  it("roda a suíte no serviço tests com o profile certo", () => {
    expect(runSuiteArgs("e2e")).toEqual([
      "compose", "-f", "docker-compose.test.yml", "--profile", "tests",
      "run", "--rm", "tests", "bun", "scripts/test-compose-entry.ts", "e2e",
    ]);
  });

  it("só apaga volumes quando pedido", () => {
    expect(downArgs({ volumes: false })).not.toContain("--volumes");
    expect(downArgs({ volumes: true })).toContain("--volumes");
  });
});

describe("buildTestEnv", () => {
  it("aplica o ambiente de CI e aponta o app para 127.0.0.1:3000", () => {
    const env = buildTestEnv({ PATH: "/bin" }, "NEXT_PUBLIC_APP_URL=http://x\nFOO=bar\n");
    expect(env.CI).toBe("true");
    expect(env.APP_ENV).toBe("test");
    expect(env.FOO).toBe("bar");
    expect(env.PATH).toBe("/bin");
    expect(env.E2E_REUSE_SERVER).toBe("1");
    expect(env.E2E_BASE_URL).toBe("http://127.0.0.1:3000");
    expect(env.DATABASE_URL).toContain("127.0.0.1:55322");
  });
});

describe("commandsForStage", () => {
  it("não roda scripts do projeto no install (evita mexer no .git do host)", () => {
    const install = commandsForStage("setup")[0];
    expect(install.args).toContain("--ignore-scripts");
  });

  it("all = unit + integration + e2e", () => {
    expect(commandsForStage("all").map((c) => c.label)).toEqual([
      "testes unitários", "testes de integração", "Playwright",
    ]);
  });
});

describe("runStage", () => {
  const record = (statuses: number[]) => {
    const ran: string[] = [];
    let i = 0;
    return {
      ran,
      deps: {
        run: (command: Command) => {
          ran.push(command.label);
          return statuses[i++] ?? 0;
        },
        log: () => {},
      },
    };
  };

  it("para no primeiro comando que falha", () => {
    const { ran, deps } = record([0, 3]);
    expect(runStage("setup", {}, deps)).toBe(3);
    expect(ran).toHaveLength(2);
  });

  it("com keepGoing roda tudo e devolve o primeiro erro", () => {
    const { ran, deps } = record([4, 0, 5]);
    expect(runStage("all", {}, deps, { keepGoing: true })).toBe(4);
    expect(ran).toHaveLength(3);
  });

  it("devolve 0 quando tudo passa", () => {
    expect(runStage("unit", {}, record([0]).deps)).toBe(0);
  });
});

describe("orquestrador do host", () => {
  it("executa build, suíte e down, nessa ordem", () => {
    const { deps, calls } = composeDeps(() => 0);
    expect(runSuite("unit", deps)).toBe(0);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toContain("build");
    expect(calls[1]).toContain("run");
    expect(calls[2]).toContain("down");
  });

  it("em falha mostra logs e propaga o exit code", () => {
    const { deps, calls } = composeDeps((args) => (args.includes("run") ? 7 : 0));
    expect(runSuite("e2e", deps)).toBe(7);
    expect(calls.filter((c) => c.includes("logs"))).toHaveLength(2);
  });

  it("KEEP_STACK mantém o stack de pé", () => {
    const { deps, calls } = composeDeps(() => 0, true);
    runSuite("unit", deps);
    expect(calls.some((c) => c.includes("down"))).toBe(false);
  });

  it("não sobe nada se o build da imagem falhar", () => {
    const { deps, calls } = composeDeps(() => 1);
    expect(runSuite("unit", deps)).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it("rejeita suíte inválida e aceita down", () => {
    const bad = composeDeps(() => 0);
    expect(main(["nope"], bad.deps)).toBe(2);
    expect(bad.calls).toHaveLength(0);

    const down = composeDeps(() => 0);
    expect(main(["down"], down.deps)).toBe(0);
    expect(down.calls[0]).toContain("--volumes");
  });
});
