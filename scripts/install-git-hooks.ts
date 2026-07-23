import { existsSync } from "node:fs"

const gitMetadataPath = `${process.cwd()}/.git`

if (process.env.CI === "true") {
  console.info("[hooks:install] CI=true — pulando configuração de hooks no runner.")
  process.exit(0)
}

if (!existsSync(gitMetadataPath)) {
  console.info("[hooks:install] Git metadata não encontrado; hooks não instalados.")
  process.exit(0)
}

const result = Bun.spawnSync(["git", "config", "core.hooksPath", ".githooks"], {
  cwd: process.cwd(),
  stdout: "inherit",
  stderr: "inherit",
})

if (result.exitCode !== 0) {
  console.error("[hooks:install] Não foi possível configurar os hooks Git.")
  process.exit(result.exitCode)
}

console.info("[hooks:install] Hooks Git configurados em .githooks.")
