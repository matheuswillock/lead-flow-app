import { describe, expect, it } from "bun:test";

import {
  DOCKERD_LOG,
  DOCKER_ROOT,
  POSTGRES_FALLBACK_IMAGE,
  POSTGRES_IMAGE,
  SKIP_DOCKER_REMOUNT_ENV,
  buildE2eEnv,
  ensureDockerOffOverlay,
  ensurePsql,
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

type OutputResponder = (call: RecordedCall) => { status: number; stdout: string };

const defaultOutput: OutputResponder = () => ({
  status: 0,
  stdout: "ext2/ext3\n",
});

function createRunner(
  respond: Responder = () => 0,
  respondOutput: OutputResponder = defaultOutput,
) {
  const calls: RecordedCall[] = [];
  const outputCalls: RecordedCall[] = [];
  const background: Array<{ command: string; args: string[]; logFile: string }> = [];
  const runner: CommandRunner = {
    run: (command, args, env) => {
      const call = { command, args, env };
      calls.push(call);
      return respond(call) ?? 0;
    },
    output: (command, args) => {
      const call = { command, args };
      outputCalls.push(call);
      return respondOutput(call);
    },
    startBackground: (command, args, logFile) => {
      background.push({ command, args, logFile });
    },
  };
  return { runner, calls, outputCalls, background };
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
  respondOutput: OutputResponder = defaultOutput,
) {
  const { runner, calls, background } = createRunner(respond, respondOutput);
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
  return { deps, calls, logger, background };
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

const overlayOutput =
  (dockerInfoStatus = 0): OutputResponder =>
  (call) =>
    call.command === "stat"
      ? { status: 0, stdout: "overlayfs\n" }
      : { status: dockerInfoStatus, stdout: "29.1.3\n" };

/** `pidof dockerd` responde "rodando" nas primeiras chamadas e "parado" depois. */
const dockerdStopsAfter = (runningChecks: number): Responder => {
  let checks = 0;
  return (call) =>
    call.command === "pidof" ? (++checks <= runningChecks ? 0 : 1) : 0;
};

describe("ensureDockerOffOverlay", () => {
  it("nao mexe no Docker sem root", async () => {
    const { runner, calls, outputCalls } = createRunner();

    const ok = await ensureDockerOffOverlay(
      runner,
      noSleep,
      createLogger().log,
      "sudo",
    );

    expect(ok).toBe(true);
    expect(calls).toEqual([]);
    expect(outputCalls).toEqual([]);
  });

  it("respeita o opt-out por variavel de ambiente", async () => {
    const { runner, calls, outputCalls } = createRunner(() => 0, overlayOutput());

    const ok = await ensureDockerOffOverlay(
      runner,
      noSleep,
      createLogger().log,
      "root",
      { [SKIP_DOCKER_REMOUNT_ENV]: "1" },
    );

    expect(ok).toBe(true);
    expect(calls).toEqual([]);
    expect(outputCalls).toEqual([]);
  });

  it("nao reinicia o Docker quando o diretorio de dados nao esta em overlayfs", async () => {
    const { runner, calls, outputCalls } = createRunner();

    const ok = await ensureDockerOffOverlay(
      runner,
      noSleep,
      createLogger().log,
      "root",
    );

    expect(ok).toBe(true);
    expect(outputCalls.map(commandLine)).toEqual([
      `stat -f -c %T ${DOCKER_ROOT}`,
    ]);
    expect(calls).toEqual([]);
  });

  it("para o dockerd, monta tmpfs no diretorio de dados e o reinicia", async () => {
    const { runner, calls, background } = createRunner(
      dockerdStopsAfter(2),
      overlayOutput(),
    );

    const ok = await ensureDockerOffOverlay(
      runner,
      noSleep,
      createLogger().log,
      "root",
    );

    expect(ok).toBe(true);
    const lines = calls.map(commandLine);
    expect(lines[0]).toBe("pkill -TERM dockerd");
    expect(lines.filter((line) => line === "pidof dockerd")).toHaveLength(3);
    expect(lines.indexOf("pkill -TERM containerd")).toBeGreaterThan(
      lines.lastIndexOf("pidof dockerd"),
    );
    expect(lines.at(-1)).toBe(`mount -t tmpfs -o size=8g tmpfs ${DOCKER_ROOT}`);
    expect(background).toEqual([
      { command: "dockerd", args: [], logFile: DOCKERD_LOG },
    ]);
  });

  it("forca o encerramento e desiste sem montar tmpfs quando o dockerd nao para", async () => {
    const { runner, calls, background } = createRunner(
      (call) => (call.command === "pidof" ? 0 : 0),
      overlayOutput(),
    );
    const logger = createLogger();

    const ok = await ensureDockerOffOverlay(runner, noSleep, logger.log, "root");

    expect(ok).toBe(false);
    const lines = calls.map(commandLine);
    expect(lines).toContain("pkill -KILL dockerd");
    expect(lines.some((line) => line.startsWith("mount"))).toBe(false);
    expect(background).toEqual([]);
    expect(logger.error.join("\n")).toContain("o dockerd nao encerrou");
  });

  it("desiste sem reiniciar o dockerd quando o mount do tmpfs falha", async () => {
    const { runner, background } = createRunner(
      (call) => (call.command === "mount" ? 1 : call.command === "pidof" ? 1 : 0),
      overlayOutput(),
    );
    const logger = createLogger();

    const ok = await ensureDockerOffOverlay(runner, noSleep, logger.log, "root");

    expect(ok).toBe(false);
    expect(background).toEqual([]);
    expect(logger.error.join("\n")).toContain("nao foi possivel montar tmpfs");
  });

  it("falha quando o dockerd nao fica pronto apos o remount", async () => {
    const { runner, outputCalls } = createRunner(
      dockerdStopsAfter(0),
      overlayOutput(1),
    );
    const logger = createLogger();

    const ok = await ensureDockerOffOverlay(runner, noSleep, logger.log, "root");

    expect(ok).toBe(false);
    expect(
      outputCalls.filter((call) => call.args[0] === "info"),
    ).toHaveLength(60);
    expect(logger.error.join("\n")).toContain("nao ficou pronto");
  });
});

/** `command -v psql` (unico uso de `output("sh", ...)`) devolve "nao encontrado". */
const withoutPsql: OutputResponder = (call) =>
  call.command === "sh"
    ? { status: 1, stdout: "" }
    : { status: 0, stdout: "ext2/ext3\n" };

describe("ensurePsql", () => {
  it("nao instala nada quando o psql ja existe", () => {
    const { runner, calls } = createRunner();

    const ok = ensurePsql(runner, createLogger().log, "root");

    expect(ok).toBe(true);
    expect(calls).toEqual([]);
  });

  it("instala o postgresql-client via apt, sem prompts, quando e root", () => {
    const { runner, calls } = createRunner(() => 0, withoutPsql);

    const ok = ensurePsql(runner, createLogger().log, "root", { PATH: "/bin" });

    expect(ok).toBe(true);
    expect(calls.map(commandLine)).toEqual([
      "apt-get update -y -o Acquire::Retries=3 -o Acquire::http::Timeout=15 -o Acquire::https::Timeout=15",
      "apt-get install -y postgresql-client",
    ]);
    for (const call of calls) {
      expect(call.env?.DEBIAN_FRONTEND).toBe("noninteractive");
      expect(call.env?.PATH).toBe("/bin");
    }
  });

  it("usa sudo -n quando nao e root mas tem sudo", () => {
    const { runner, calls } = createRunner(() => 0, withoutPsql);

    const ok = ensurePsql(runner, createLogger().log, "sudo");

    expect(ok).toBe(true);
    expect(calls.map(commandLine)).toEqual([
      "sudo -n apt-get update -y -o Acquire::Retries=3 -o Acquire::http::Timeout=15 -o Acquire::https::Timeout=15",
      "sudo -n apt-get install -y postgresql-client",
    ]);
  });

  it("falha sem tentar instalar quando nao ha root nem sudo", () => {
    const { runner, calls } = createRunner(() => 0, withoutPsql);
    const logger = createLogger();

    const ok = ensurePsql(runner, logger.log, "none");

    expect(ok).toBe(false);
    expect(calls).toEqual([]);
    expect(logger.error.join("\n")).toContain("sem root/sudo");
  });

  it("nao tenta instalar quando o apt-get update falha", () => {
    const { runner, calls } = createRunner(
      (call) => (call.args.includes("update") ? 100 : 0),
      withoutPsql,
    );
    const logger = createLogger();

    const ok = ensurePsql(runner, logger.log, "root");

    expect(ok).toBe(false);
    expect(calls.map(commandLine).some((line) => line.includes("install"))).toBe(
      false,
    );
    expect(logger.error.join("\n")).toContain("apt-get update falhou");
  });

  it("devolve false quando a instalacao falha", () => {
    const { runner } = createRunner(
      (call) => (call.args.includes("install") ? 100 : 0),
      withoutPsql,
    );
    const logger = createLogger();

    const ok = ensurePsql(runner, logger.log, "root");

    expect(ok).toBe(false);
    expect(logger.error.join("\n")).toContain("postgresql-client falhou");
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
  it("sobe o container em rede host na porta 55322 com os dois scripts de init montados", async () => {
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
    expect(line).toContain("--network host");
    // O migrate.sh da imagem ignora PGPORT e usa 5432: nada de remapear porta.
    expect(line).not.toContain("PGPORT");
    expect(line).not.toContain("-p 55322:5432");
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

  it("checa a porta informada (a do encaminhador) quando ela e passada", async () => {
    const { runner, calls } = createRunner();

    const ok = await waitForPostgres(runner, noSleep, "pg-1", 5, 1, 55322);

    expect(ok).toBe(true);
    expect(commandLine(calls[0])).toBe(
      "docker exec pg-1 pg_isready -h 127.0.0.1 -p 55322 -U postgres",
    );
  });

  it("retorna false apos esgotar as tentativas", async () => {
    const { runner, calls } = createRunner(() => 1);

    const ok = await waitForPostgres(runner, noSleep, "pg-1", 4, 1);

    expect(ok).toBe(false);
    expect(calls).toHaveLength(4);
  });

  it("falha na hora, sem esperar o tempo todo, quando o container ja morreu", async () => {
    const { runner, calls, outputCalls } = createRunner(
      () => 0,
      (call) =>
        call.args[0] === "inspect"
          ? { status: 0, stdout: "false\n" }
          : { status: 0, stdout: "" },
    );

    const ok = await waitForPostgres(runner, noSleep, "pg-1");

    expect(ok).toBe(false);
    expect(calls).toEqual([]);
    expect(outputCalls.map(commandLine)).toEqual([
      "docker inspect -f {{.State.Running}} pg-1",
    ]);
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
    expect(index("playwright install")).toBeLessThan(
      index("bun run test:e2e --reporter=list,html"),
    );
    // Rodar o Playwright com `bunx --bun` quebra o carregamento das specs .ts.
    expect(lines.some((line) => line.includes("--bun playwright test"))).toBe(
      false,
    );
    expect(lines.at(-1)).toBe("docker rm -f e2e-postgres-ci-1");
  });

  it("encaminha 55322 para o Postgres em 5432 e so segue quando a porta responde", async () => {
    const { deps, calls, background } = createDeps();

    const exitCode = await runE2eCi(deps);

    expect(exitCode).toBe(0);
    expect(background).toContainEqual({
      command: "bun",
      args: ["/repo/scripts/tcp-forward.ts", "55322", "5432"],
      logFile: "/tmp/tcp-forward-ci-e2e.log",
    });
    const lines = calls.map(commandLine);
    const onContainerPort = lines.findIndex((line) =>
      line.includes("pg_isready -h 127.0.0.1 -p 5432"),
    );
    const onForwardedPort = lines.findIndex((line) =>
      line.includes("pg_isready -h 127.0.0.1 -p 55322"),
    );
    expect(onContainerPort).toBeGreaterThan(-1);
    expect(onForwardedPort).toBeGreaterThan(onContainerPort);
    expect(onForwardedPort).toBeLessThan(
      lines.findIndex((line) => line.includes("db:seed:e2e")),
    );
  });

  it("falha com diagnostico e log do encaminhador quando 55322 nao responde", async () => {
    const { deps, calls } = createDeps((call) =>
      call.args.includes("pg_isready") && call.args.includes("55322") ? 1 : 0,
    );

    const exitCode = await runE2eCi(deps);

    expect(exitCode).toBe(1);
    const lines = calls.map(commandLine);
    expect(lines.some((line) => line.includes("tcp-forward-ci-e2e.log"))).toBe(
      true,
    );
    expect(lines.some((line) => line.includes("db:seed:e2e"))).toBe(false);
    expect(lines.at(-2)).toBe("pkill -f scripts/tcp-forward.ts");
    expect(lines.at(-1)).toBe("docker rm -f e2e-postgres-ci-1");
  });

  it("instala o psql antes do seed e nao semeia se a instalacao falhar", async () => {
    const ok = createDeps(() => 0, {}, withoutPsql);
    expect(await runE2eCi(ok.deps)).toBe(0);
    const lines = ok.calls.map(commandLine);
    expect(
      lines.findIndex((line) => line.startsWith("apt-get install")),
    ).toBeLessThan(lines.findIndex((line) => line.includes("db:seed:e2e")));

    const failing = createDeps(
      (call) => (call.args.includes("install") ? 100 : 0),
      {},
      withoutPsql,
    );
    expect(await runE2eCi(failing.deps)).toBe(1);
    expect(
      failing.calls.map(commandLine).some((line) => line.includes("db:seed:e2e")),
    ).toBe(false);
    expect(failing.calls.map(commandLine).at(-1)).toBe(
      "docker rm -f e2e-postgres-ci-1",
    );
  });

  it("regenera o Prisma Client para a plataforma da tarefa antes do seed, da integracao e do build", async () => {
    const ok = createDeps();
    expect(await runE2eCi(ok.deps)).toBe(0);
    const lines = ok.calls.map(commandLine);
    const generate = lines.indexOf("bun run prisma:generate");
    expect(generate).toBeGreaterThan(-1);
    expect(generate).toBeLessThan(
      lines.findIndex((line) => line.includes("db:seed:e2e")),
    );
    expect(generate).toBeLessThan(lines.indexOf("bun run test:integration"));
    expect(generate).toBeLessThan(lines.indexOf("bun run build"));
    expect(ok.calls[generate].env?.DATABASE_URL).toContain("127.0.0.1:55322");

    const failing = createDeps((call) =>
      commandLine(call) === "bun run prisma:generate" ? 1 : 0,
    );
    expect(await runE2eCi(failing.deps)).toBe(1);
    const failingLines = failing.calls.map(commandLine);
    expect(failingLines.some((line) => line.includes("db:seed:e2e"))).toBe(
      false,
    );
    expect(failingLines.at(-1)).toBe("docker rm -f e2e-postgres-ci-1");
  });

  it("passa o ambiente de E2E para seed, integracao, build e Playwright", async () => {
    const { deps, calls } = createDeps();

    await runE2eCi(deps);

    const envStages = [
      "bun run prisma:generate",
      "bun run db:seed:e2e",
      "bun run test:integration",
      "bun run build",
      "bunx --bun playwright install --with-deps chromium",
      "bun run test:e2e --reporter=list,html",
    ];
    const withEnv = calls.filter((call) =>
      envStages.includes(commandLine(call)),
    );
    expect(withEnv.map(commandLine)).toEqual(envStages);
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
    expect(lines.some((line) => line.includes("test:e2e"))).toBe(false);
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

  it("imprime estado e logs do container quando o Postgres cai logo apos subir", async () => {
    const { deps, calls } = createDeps(
      () => 0,
      {},
      (call) =>
        call.args[0] === "inspect"
          ? { status: 0, stdout: "false\n" }
          : { status: 0, stdout: "ext2/ext3\n" },
    );

    const exitCode = await runE2eCi(deps);

    expect(exitCode).toBe(1);
    const lines = calls.map(commandLine);
    expect(lines).toContain(
      "docker inspect -f {{json .State}} e2e-postgres-ci-1",
    );
    expect(lines).toContain("docker logs --tail 150 e2e-postgres-ci-1");
    expect(lines.some((line) => line.includes("db:seed:e2e"))).toBe(false);
    expect(lines.at(-1)).toBe("docker rm -f e2e-postgres-ci-1");
  });

  it("falha sem subir o Postgres quando a imagem nao pode ser baixada", async () => {
    const { deps, calls } = createDeps((call) =>
      call.args[0] === "pull" ? 1 : 0,
    );

    const exitCode = await runE2eCi(deps);

    expect(exitCode).toBe(1);
    expect(calls.some((call) => call.args[0] === "run")).toBe(false);
  });

  it("remonta o storage do Docker em tmpfs antes de baixar a imagem", async () => {
    const { deps, calls } = createDeps(
      dockerdStopsAfter(1),
      {},
      overlayOutput(),
    );

    const exitCode = await runE2eCi(deps);

    expect(exitCode).toBe(0);
    const lines = calls.map(commandLine);
    expect(
      lines.findIndex((line) => line.startsWith("mount -t tmpfs")),
    ).toBeGreaterThan(-1);
    expect(
      lines.findIndex((line) => line.startsWith("mount -t tmpfs")),
    ).toBeLessThan(lines.findIndex((line) => line.startsWith("docker pull")));
  });

  it("falha com diagnostico, sem baixar a imagem, quando o remount nao funciona", async () => {
    const { deps, calls } = createDeps(
      (call) => (call.command === "mount" ? 1 : call.command === "pidof" ? 1 : 0),
      {},
      overlayOutput(),
    );

    const exitCode = await runE2eCi(deps);

    expect(exitCode).toBe(1);
    const lines = calls.map(commandLine);
    expect(lines).toContain("docker info");
    expect(lines.some((line) => line.startsWith("docker pull"))).toBe(false);
    expect(lines.at(-1)).toBe("docker rm -f e2e-postgres-ci-1");
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
