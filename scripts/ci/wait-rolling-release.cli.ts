import { execFileSync } from "node:child_process"
import { appendFileSync } from "node:fs"
import { parseRollingReleaseOutput, redactSecret, waitForRollingRelease } from "./wait-rolling-release"

const deployUrl = process.env.DEPLOY_URL ?? ""
const token = process.env.VERCEL_TOKEN ?? ""
if (!deployUrl || !token) {
  console.error("::error::DEPLOY_URL e VERCEL_TOKEN são obrigatórios")
  process.exit(1)
}

// O token segue só pelo ambiente (a CLI lê VERCEL_TOKEN): em argv ele apareceria
// na mensagem de erro do execFileSync e, daí, no log e no step summary.
function fetchRollingReleaseOutput(): string {
  try {
    return execFileSync("npx", ["--yes", "vercel@56.3.2", "rolling-release", "fetch", "--non-interactive"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    })
  } catch (error) {
    const { status, stderr } = error as { status?: number | null; stderr?: Buffer | string }
    const tail = String(stderr ?? "").trim().split("\n").slice(-3).join(" | ")
    throw new Error(redactSecret(`vercel rolling-release fetch saiu com ${status ?? "?"}: ${tail}`, token))
  }
}

const verdict = await waitForRollingRelease(
  {
    deployUrl,
    timeoutMs: Number(process.env.TIMEOUT_MINUTES ?? 20) * 60_000,
    intervalMs: Number(process.env.INTERVAL_SECONDS ?? 20) * 1000,
  },
  {
    fetchRelease: async () => parseRollingReleaseOutput(fetchRollingReleaseOutput()),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    log: (message) => console.info(redactSecret(message, token)),
  }
)

const detail = redactSecret(verdict.detail, token)
const summary = process.env.GITHUB_STEP_SUMMARY
if (summary) {
  appendFileSync(summary, `\n### Rolling release\n\n- ${verdict.kind}: ${detail}\n`)
}
if (verdict.kind !== "complete") {
  console.error(`::error::${detail}`)
  process.exit(1)
}
