// Espera o rolling release da Vercel levar o deployment recém-publicado a 100%.
// O job de deploy só prova que o deployment subiu e responde; o tráfego migra
// depois, em estágios (hoje 10% por 5 min, depois 100%).

export type RollingRelease = {
  state?: string
  currentDeployment?: { url?: string } | null
  canaryDeployment?: { url?: string } | null
  currentCanaryPercentage?: number
}

export type RollingReleaseVerdict =
  | { kind: "complete"; detail: string }
  | { kind: "pending"; detail: string }
  | { kind: "failed"; detail: string }

const FAILED_STATES = new Set(["ABORTED", "FAILED", "CANCELED", "CANCELLED"])

export function hostOf(urlOrHost: string): string {
  return urlOrHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase()
}

/**
 * Lê a resposta da API REST da Vercel (`GET /v1/projects/{id}/rolling-release`). O corpo vem embrulhado em
 * `{ "rollingRelease": {...} }` e `rollingRelease` é `null` quando o projeto ainda não teve rollout. A CLI
 * `vercel rolling-release fetch` não serve aqui: ela imprime texto para humanos, sem JSON.
 */
export function parseRollingReleaseOutput(output: string): RollingRelease {
  const start = output.indexOf("{")
  const end = output.lastIndexOf("}")
  if (start === -1 || end < start) {
    throw new Error("resposta da API de rolling release sem JSON")
  }
  const body = JSON.parse(output.slice(start, end + 1)) as { rollingRelease?: RollingRelease | null } & RollingRelease
  if ("rollingRelease" in body) return body.rollingRelease ?? {}
  return body
}

export function buildRollingReleaseUrl(input: { projectId: string; teamId?: string }): string {
  const url = new URL(`https://api.vercel.com/v1/projects/${encodeURIComponent(input.projectId)}/rolling-release`)
  if (input.teamId) url.searchParams.set("teamId", input.teamId)
  return url.toString()
}

export function evaluateRollingRelease(
  release: RollingRelease,
  deployUrl: string
): RollingReleaseVerdict {
  const target = hostOf(deployUrl)
  const state = (release.state ?? "").toUpperCase()
  const canaryHost = release.canaryDeployment?.url ? hostOf(release.canaryDeployment.url) : null
  const currentHost = release.currentDeployment?.url ? hostOf(release.currentDeployment.url) : null
  const isCanary = canaryHost === target
  const isCurrent = currentHost === target

  if (!isCanary && !isCurrent) {
    // Logo após o deploy a API ainda pode listar o release anterior.
    return { kind: "pending", detail: `rolling release ainda não aponta para ${target} (estado ${state || "?"})` }
  }
  if (FAILED_STATES.has(state)) {
    return { kind: "failed", detail: `rolling release terminou ${state} antes de chegar a 100%` }
  }
  if (state === "COMPLETE" && (isCanary || isCurrent)) {
    return { kind: "complete", detail: `rolling release COMPLETE em ${target}` }
  }
  return {
    kind: "pending",
    detail: `estado ${state || "?"}, canary em ${release.currentCanaryPercentage ?? "?"}%`,
  }
}

export type WaitDeps = {
  fetchRelease: () => Promise<RollingRelease>
  sleep: (ms: number) => Promise<void>
  now: () => number
  log: (message: string) => void
}

export type WaitOptions = { deployUrl: string; timeoutMs: number; intervalMs: number }

export async function waitForRollingRelease(
  options: WaitOptions,
  deps: WaitDeps
): Promise<RollingReleaseVerdict> {
  const deadline = deps.now() + options.timeoutMs
  let last: RollingReleaseVerdict = { kind: "pending", detail: "sem leitura ainda" }

  while (deps.now() < deadline) {
    try {
      last = evaluateRollingRelease(await deps.fetchRelease(), options.deployUrl)
    } catch (error) {
      // Falha transitória de CLI/rede não reprova o deploy; segue até o prazo.
      last = { kind: "pending", detail: `leitura falhou: ${(error as Error).message}` }
    }
    deps.log(`[rolling-release] ${last.kind}: ${last.detail}`)
    if (last.kind !== "pending") return last
    await deps.sleep(options.intervalMs)
  }

  return { kind: "failed", detail: `tempo esgotado; última leitura: ${last.detail}` }
}

export function redactSecret(text: string, secret: string): string {
  return secret ? text.split(secret).join("***") : text
}
