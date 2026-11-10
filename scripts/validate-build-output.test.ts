import { describe, expect, it } from "bun:test";

import {
  runValidateBuildOutput,
  validateNextBuildOutput,
  type BuildOutputFs,
} from "./validate-build-output";

interface FakeEntries {
  directories?: string[];
  files?: Record<string, string>;
}

function createFakeFs({
  directories = [],
  files = {},
}: FakeEntries): BuildOutputFs {
  return {
    exists: (targetPath) =>
      directories.includes(targetPath) || targetPath in files,
    isDirectory: (targetPath) => directories.includes(targetPath),
    readText: (targetPath) => files[targetPath] ?? "",
  };
}

const COMPLETE_OUTPUT: Required<FakeEntries> = {
  directories: [".next", ".next/server"],
  files: {
    ".next/BUILD_ID": "abc123\n",
    ".next/required-server-files.json": "{}",
  },
};

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

describe("validateNextBuildOutput", () => {
  it("aceita um build completo e devolve o BUILD_ID sem quebra de linha", () => {
    const result = validateNextBuildOutput(createFakeFs(COMPLETE_OUTPUT));

    expect(result).toEqual({ ok: true, failures: [], buildId: "abc123" });
  });

  it("reprova quando o build nao produziu .next", () => {
    const result = validateNextBuildOutput(createFakeFs({}));

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(["build nao produziu .next"]);
  });

  it("reprova quando BUILD_ID esta ausente (build interrompido com exit 0)", () => {
    const result = validateNextBuildOutput(
      createFakeFs({
        directories: COMPLETE_OUTPUT.directories,
        files: { ".next/required-server-files.json": "{}" },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      ".next/BUILD_ID ausente — build nao concluiu",
    ]);
  });

  it("reprova quando BUILD_ID existe mas esta vazio", () => {
    const result = validateNextBuildOutput(
      createFakeFs({
        directories: COMPLETE_OUTPUT.directories,
        files: {
          ".next/BUILD_ID": "  \n",
          ".next/required-server-files.json": "{}",
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.buildId).toBeNull();
    expect(result.failures).toEqual([
      ".next/BUILD_ID vazio — build nao concluiu",
    ]);
  });

  it("reprova quando .next/server nao foi emitido", () => {
    const result = validateNextBuildOutput(
      createFakeFs({
        directories: [".next"],
        files: COMPLETE_OUTPUT.files,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      ".next/server ausente — nada de servidor foi emitido",
    ]);
  });

  it("reprova quando required-server-files.json esta ausente", () => {
    const result = validateNextBuildOutput(
      createFakeFs({
        directories: COMPLETE_OUTPUT.directories,
        files: { ".next/BUILD_ID": "abc123" },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      ".next/required-server-files.json ausente — build incompleto",
    ]);
  });

  it("lista todas as falhas de uma vez quando o .next esta quase vazio", () => {
    const result = validateNextBuildOutput(
      createFakeFs({ directories: [".next"] }),
    );

    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(3);
  });

  it("respeita um diretorio de build customizado", () => {
    const result = validateNextBuildOutput(
      createFakeFs({
        directories: ["out", "out/server"],
        files: {
          "out/BUILD_ID": "xyz",
          "out/required-server-files.json": "{}",
        },
      }),
      "out",
    );

    expect(result).toEqual({ ok: true, failures: [], buildId: "xyz" });
  });
});

describe("runValidateBuildOutput", () => {
  it("retorna 0 e registra o BUILD_ID quando o build esta completo", () => {
    const { info, error, log } = createLogger();

    const exitCode = runValidateBuildOutput(
      createFakeFs(COMPLETE_OUTPUT),
      log,
    );

    expect(exitCode).toBe(0);
    expect(error).toEqual([]);
    expect(info).toEqual([
      "[build:verify] BUILD_ID: abc123",
      "[build:verify] Build output OK (modo next).",
    ]);
  });

  it("retorna 1 e imprime cada falha quando o build esta incompleto", () => {
    const { info, error, log } = createLogger();

    const exitCode = runValidateBuildOutput(
      createFakeFs({ directories: [".next"] }),
      log,
    );

    expect(exitCode).toBe(1);
    expect(info).toEqual([]);
    expect(error).toHaveLength(3);
    expect(error.every((line) => line.startsWith("[build:verify] "))).toBe(
      true,
    );
  });
});
