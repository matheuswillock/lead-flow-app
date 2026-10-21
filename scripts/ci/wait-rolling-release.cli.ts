import { execFileSync } from "node:child_process"
import { appendFileSync } from "node:fs"
import { parseRollingReleaseOutput, waitForRollingRelease } from "./wait-rolling-release"

const deployUrl = process.env.DEPLOY_URL ?? ""
const token = process.env.VERCEL_TOKEN ?? ""
if (!deployUrl || !token) {
  console.error("::error::DEPLOY_URL e VERCEL_TOKEN são obrigatórios")
  process.exit(1)
}

const verdict = await waitForRollingRelease(
  {
    deployUrl,
    timeoutMs: Number(process.env.TIMEOUT_MINUTES ?? 20) * 60_000,
    intervalMs: Number(process.env.INTERVAL_SECONDS ?? 20) * 1000,
  },
  {
    fetchRelease: async () =>
      parseRollingReleaseOutput(
        execFileSync(
          "npx",
          ["--yes", "vercel@56.3.2", "rolling-release", "fetch", "--token", token, "--non-interactive"],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
        )
      ),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    log: (message) => console.info(message),
  }
)

const summary = process.env.GITHUB_STEP_SUMMARY
if (summary) {
  appendFileSync(summary, `\n### Rolling release\n\n- ${verdict.kind}: ${verdict.detail}\n`)
}
if (verdict.kind !== "complete") {
  console.error(`::error::${verdict.detail}`)
  process.exit(1)
}
