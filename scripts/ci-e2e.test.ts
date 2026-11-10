import { describe, expect, it } from "bun:test";

import {
  POSTGRES_FALLBACK_IMAGE,
  POSTGRES_IMAGE,
  buildE2eEnv,
  parseEnvFile,
  pullPostgresImage,
  runE2eCi,
  startPostgres,
  waitForPostgres,
  type CommandRunner,
  type E2eDeps,
  type EnvMap,
  type Privilege,
} from "./ci-e2e";

interface RecordedCall {
  command: string;
  args: string[];
  env?: EnvMap;
}

type Responder = (call: RecordedCall) => number | undefined;

function createRunner(respond: Responder = () => 0) {
  const calls: RecordedCall[] = [];
  const runner: CommandRunner = {
    run: (command, args, env) => {
      const call = { command, args, env };
      calls.push(call);
      return respond(call) ?? 0;
    },
  };
  return { runner, calls };
}

const noSleep = async () => {};

function createLogger() {
  const info: string[] = [];
  const error: string[] = [];
  return {
    info,
    error,
    log: {
      info: (message: string) => void info.push(message),
      error: (message: string) => void error.push(message),
    },
  };
}

function createDeps(
  respond: Responder = () => 0,
  overrides: Partial<E2eDeps> = {},
) {
  const { runner, calls } = createRunner(respond);
  const logger = createLogger();
  const deps: E2eDeps = {
    runner,
    sleep: noSleep,
    log: logger.log,
    baseEnv: { PATH: "/usr/bin" },
    envExampleText: "APP_ENV=dev\nRESEND_API_KEY=re_placeholder\n",
    cwd: "/repo",
    privilege: "root" satisfies Privilege,
    containerName: "e2e-postgres-ci-1",
    ...overrides,
  };
  return { deps, calls, logger };
}

const commandLine = (call: RecordedCall) =>
  [call.command, ...call.args].join(" ");

describe("parseEnvFile", () => {
  it("ignora comentarios e linhas vazias e preserva o valor literal", () => {
    const parsed = parseEnvFile(
      [
        "# comentario",
        "",
        "APP_ENV=test",
        "ASAAS_LEGACY_API_KEY=",
        "URL=postgresql://u:p@h:1/db?a=b=c",
        "SEM_IGUAL",
        "=sem_chave",
      ].join("\r\n"),
    );

    expect(parsed).toEqual({
      APP_ENV: "test",
      ASAAS_LEGACY_API_KEY: "",
      URL: "postgresql://u:p@h:1/db?a=b=c",
    });
  });
});

describe("buildE2eEnv", () => {
  it("aplica os overrides de CI por cima do exemplo e do ambiente base", () => {
    const env = buildE2eEnv(
      { PATH: "/usr/bin", APP_ENV: "production" },
      { APP_ENV: "dev", RESEND_API_KEY: "re_placeholder" },
    );

    expect(env.APP_ENV).toBe("test");
    expect(env.E2E_TEST_MODE).toBe("true");
    expect(env.E2E_INCLUDE_SLOW).toBe("false");
    expect(env.CI).toBe("true");
    expect(env.PATH).toBe("/usr/bin");
    expect(env.RESEND_API_KEY).toBe("re_placeholder");
    expect(env.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
    );
    expect(env.DIRECT_URL).toBe(env.DATABASE_URL);
    expect(env.ASAAS_ENV).toBe("sandbox");
  });

  it("usa a chave sandbox da CI quando existe e o placeholder quando nao", () => {
    const withKey = buildE2eEnv(
      { ASAAS_SANDBOX_API_KEY: "aact_hmlg_real" },
      { ASAAS_API_KEY: "placeholder", ASAAS_SANDBOX_API_KEY: "placeholder" },
    );
    expect(withKey.ASAAS_API_KEY).toBe("aact_hmlg_real");
    expect(withKey.ASAAS_SANDBOX_API_KEY).toBe("aact_hmlg_real");

    const withoutKey = buildE2eEnv(
      {},
      { ASAAS_API_KEY: "placeholder", ASAAS_SANDBOX_API_KEY: "placeholder" },
    );
    expect(withoutKey.ASAAS_API_KEY).toBe("placeholder");
    expect(withoutKey.ASAAS_SANDBOX_API_KEY).toBe("placeholder");
  });
});

describe("pullPostgresImage", () => {
  it("retorna true no primeiro pull bem-sucedido do ghcr", async () => {
    const { runner, calls } = createRunner();

    const ok = await pullPostgresImage(runner, noSleep, createLogger().log);

    expect(ok).toBe(true);
    expect(calls.map(commandLine)).toEqual([`docker pull ${POSTGRES_IMAGE}`]);
  });

  it("cai para o Docker Hub e re-etiqueta quando o ghcr falha", async () => {
    const { runner, calls } = createRunner((call) =>
      call.args.join(" ") === `pull ${POSTGRES_IMAGE}` ? 1 : 0,
    );

    const ok = await pullPostgresImage(runner, noSleep, createLogger().log);

    expect(ok).toBe(true);
    expect(calls.map(commandLine)).toEqual([
      `docker pull ${POSTGRES_IMAGE}`,
      `docker pull ${POSTGRES_FALLBACK_IMAGE}`,
      `docker tag ${POSTGRES_FALLBACK_IMAGE} ${POSTGRES_IMAGE}`,
    ]);
  });

  it("repete com backoff exponencial e desiste apos o limite de tentativas", async () => {
    const { runner, calls } = createRunner(() => 1);
    const delays: number[] = [];

    const ok = await pullPostgresImage(
      runner,
      async (ms) => void delays.push(ms),
      createLogger().log,
      3,
      10,
    );

    expect(ok).toBe(false);
    expect(calls).toHaveLength(6);
    expect(delays).toEqual([10, 20]);
  });
});

describe("startPostgres", () => {
  it("sobe o container na porta 55322 com os dois scripts de init montados", async () => {
    const { runner, calls } = createRunner();

    const ok = await startPostgres(
      runner,
      noSleep,
      createLogger().log,
      "pg-1",
      "/repo",
    );

    expect(ok).toBe(true);
    const line = commandLine(calls[0]);
    expect(line).toContain("docker run -d --name pg-1");
    expect(line).toContain("-p 55322:5432");
    expect(line).toContain(
      "/repo/docker/local/zz-init-auth-stub-schema.sql:/docker-entrypoint-initdb.d/zz-init-auth-stub-schema.sql:ro",
    );
    expect(line).toContain(
      "/repo/docker/local/zz-init-storage-stub-schema.sql:/docker-entrypoint-initdb.d/zz-init-storage-stub-schema.sql:ro",
    );
    expect(line).toContain("wal_level=logical");
  });

  it("remove o container e repete quando o bind falha, e desiste na 3a falha", async () => {
    const { runner, calls } = createRunner((call) =>
      call.args[0] === "run" ? 1 : 0,
    );

    const ok = await startPostgres(
      runner,
      noSleep,
      createLogger().log,
      "pg-1",
      "/repo",
    );

    expect(ok).toBe(false);
    const lines = calls.map(commandLine);
    expect(lines.filter((line) => line.startsWith("docker run"))).toHaveLength(3);
    expect(lines.filter((line) => line === "docker rm -f pg-1")).toHaveLength(2);
  });
});

describe("waitForPostgres", () => {
  it("checa por TCP dentro do container e retorna true quando fica pronto", async () => {
    let attempts = 0;
    const { runner, calls } = createRunner(() => (++attempts < 3 ? 1 : 0));

    const ok = await waitForPostgres(runner, noSleep, "pg-1");

    expect(ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(commandLine(calls[0])).toBe(
      "docker exec pg-1 pg_isready -h 127.0.0.1 -p 5432 -U postgres",
    );
  });

  it("retorna false apos esgotar as tentativas", async () => {
    const { runner, calls } = createRunner(() => 1);

    const ok = await waitForPostgres(runner, noSleep, "pg-1", 4, 1);

    expect(ok).toBe(false);
    expect(calls).toHaveLength(4);
  });
});

describe("runE2eCi", () => {
  it("executa as etapas na ordem e derruba o container no fim", async () => {
    const { deps, calls } = createDeps();

    const exitCode = await runE2eCi(deps);

    expect(exitCode).toBe(0);
    const lines = calls.map(commandLine);
    const index = (needle: string) =>
      lines.findIndex((line) => line.includes(needle));

    expect(index("docker pull")).toBeLessThan(index("docker run"));
    expect(index("docker run")).toBeLessThan(index("pg_isready"));
    expect(index("pg_isready")).toBeLessThan(index("db:seed:e2e"));
    expect(index("db:seed:e2e")).toBeLessThan(index("test:integration"));
    expect(index("test:integration")).toBeLessThan(index("run build"));
    expect(index("run build")).toBeLessThan(index("playwright install"));
    expect(index("playwright install")).toBeLessThan(index("playwright test"));
    expect(lines.at(-1)).toBe("docker rm -f e2e-postgres-ci-1");
  });

  it("passa o ambiente de E2E para seed, integracao, build e Playwright", async () => {
    const { deps, calls } = createDeps();

    await runE2eCi(deps);

    const withEnv = calls.filter((call) =>
      ["db:seed:e2e", "test:integration", "run build", "playwright"].some(
        (needle) => commandLine(call).includes(needle),
      ),
    );
    expect(withEnv.length).toBeGreaterThanOrEqual(5);
    for (const call of withEnv) {
      expect(call.env?.APP_ENV).toBe("test");
      expect(call.env?.DATABASE_URL).toContain("127.0.0.1:55322");
    }
  });

  it("para na primeira etapa que falha, devolve o exit code e ainda limpa o container", async () => {
    const { deps, calls, logger } = createDeps((call) =>
      commandLine(call).includes("test:integration") ? 3 : 0,
    );

    const exitCode = await runE2eCi(deps);

    expect(exitCode).toBe(3);
    const lines = calls.map(commandLine);
    expect(lines.some((line) => line.includes("run build"))).toBe(false);
    expect(lines.some((line) => line.includes("playwright test"))).toBe(false);
    expect(lines.at(-1)).toBe("docker rm -f e2e-postgres-ci-1");
    expect(logger.error.join("\n")).toContain(
      'etapa "testes de integração" falhou (exit 3)',
    );
  });

  it("falha sem rodar seed quando o Postgres nunca fica pronto", async () => {
    const { deps, calls } = createDeps((call) =>
      call.args.includes("pg_isready") ? 1 : 0,
    );

    const exitCode = await runE2eCi(deps);

    expect(exitCode).toBe(1);
    expect(calls.map(commandLine).some((l) => l.includes("db:seed:e2e"))).toBe(
      false,
    );
  });

  it("falha sem subir o Postgres quando a imagem nao pode ser baixada", async () => {
    const { deps, calls } = createDeps((call) =>
      call.args[0] === "pull" ? 1 : 0,
    );

    const exitCode = await runE2eCi(deps);

    expect(exitCode).toBe(1);
    expect(calls.some((call) => call.args[0] === "run")).toBe(false);
  });

  it("coleta o diagnostico do Docker quando o container nao sobe, sem deixar de limpar", async () => {
    const { deps, calls, logger } = createDeps((call) =>
      call.args[0] === "run" && call.args.includes(POSTGRES_IMAGE) ? 1 : 0,
    );

    const exitCode = await runE2eCi(deps);

    expect(exitCode).toBe(1);
    const lines = calls.map(commandLine);
    expect(lines).toContain("docker info");
    expect(lines).toContain("docker run --rm busybox:1.36 true");
    expect(lines.some((line) => line.startsWith("df -T"))).toBe(true);
    expect(lines.some((line) => line.includes("daemon.json"))).toBe(true);
    expect(lines.at(-1)).toBe("docker rm -f e2e-postgres-ci-1");
    expect(logger.info.join("\n")).toContain(
      "diagnostico: imagem minima (1 camada) -> exit 0",
    );
    expect(lines.some((line) => line.includes("db:seed:e2e"))).toBe(false);
  });

  it("nao roda o diagnostico quando o Postgres sobe normalmente", async () => {
    const { deps, calls } = createDeps();

    await runE2eCi(deps);

    expect(calls.map(commandLine)).not.toContain("docker info");
  });

  it("instala o Chromium com dependencias de sistema so com root ou sudo", async () => {
    const privileged = createDeps(() => 0, { privilege: "sudo" });
    await runE2eCi(privileged.deps);
    const withDeps = privileged.calls.map(commandLine);
    expect(withDeps).toContain("sudo -n sysctl -w net.ipv4.ip_local_reserved_ports=55322");
    expect(withDeps).toContain("bunx --bun playwright install --with-deps chromium");

    const unprivileged = createDeps(() => 0, { privilege: "none" });
    await runE2eCi(unprivileged.deps);
    const withoutDeps = unprivileged.calls.map(commandLine);
    expect(withoutDeps).toContain("bunx --bun playwright install chromium");
    expect(withoutDeps.some((line) => line.includes("sysctl"))).toBe(false);
  });
});
