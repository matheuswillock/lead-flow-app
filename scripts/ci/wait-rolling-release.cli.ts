import { appendFileSync } from "node:fs"
import {
  buildRollingReleaseUrl,
  parseRollingReleaseOutput,
  redactSecret,
  waitForRollingRelease,
} from "./wait-rolling-release"

const deployUrl = process.env.DEPLOY_URL ?? ""
const token = process.env.VERCEL_TOKEN ?? ""
const projectId = process.env.VERCEL_PROJECT_ID ?? ""
if (!deployUrl || !token || !projectId) {
  console.error("::error::DEPLOY_URL, VERCEL_TOKEN e VERCEL_PROJECT_ID são obrigatórios")
  process.exit(1)
}

const endpoint = buildRollingReleaseUrl({ projectId, teamId: process.env.VERCEL_ORG_ID || undefined })

// A API REST devolve JSON; a CLI `vercel rolling-release fetch` só imprime texto para humanos e o parser nunca
// achava o JSON. O token vai só no header e a mensagem de erro passa por `redactSecret` antes de ir ao log.
async function fetchRollingReleaseOutput(): Promise<string> {
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })
  const body = await response.text()
  if (!response.ok) {
    throw new Error(redactSecret(`API da Vercel respondeu ${response.status}: ${body.slice(0, 200)}`, token))
  }
  return body
}

const verdict = await waitForRollingRelease(
  {
    deployUrl,
    timeoutMs: Number(process.env.TIMEOUT_MINUTES ?? 20) * 60_000,
    intervalMs: Number(process.env.INTERVAL_SECONDS ?? 20) * 1000,
  },
  {
    fetchRelease: async () => parseRollingReleaseOutput(await fetchRollingReleaseOutput()),
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
