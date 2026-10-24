// Espera o rolling release da Vercel levar o deployment recém-publicado a 100%.
// O job de deploy só prova que o deployment subiu e responde; o tráfego migra
// depois, em estágios (hoje 10% por 5 min, depois 100%).

export type RollingRelease = {
  state?: string
  currentDeployment?: { url?: string; readyState?: string } | null
  canaryDeployment?: { url?: string; readyState?: string } | null
  currentCanaryPercentage?: number
}

export type RollingReleaseVerdict =
  | { kind: "complete"; detail: string }
  | { kind: "pending"; detail: string }
  | { kind: "failed"; detail: string }

// Estados oficiais da API da Vercel (GET /v1/projects/{id}/rolling-release): ACTIVE, COMPLETE e
// ABORTED. Os demais nomes de falha ficam como cinto de segurança; qualquer outro valor é tratado
// como desconhecido (nunca conclui o job) e aparece na mensagem de prazo esgotado.
const KNOWN_STATES_LABEL = "ACTIVE, COMPLETE, ABORTED"
const FAILED_STATES = new Set(["ABORTED", "FAILED", "CANCELED", "CANCELLED"])
const IN_PROGRESS_STATES = new Set(["ACTIVE"])
// readyState do deployment canary que significa que ele nunca vai chegar a 100%.
const FAILED_CANARY_READY_STATES = new Set(["ERROR", "CANCELED"])

export function hostOf(urlOrHost: string): string {
  return urlOrHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase()
}

export function parseRollingReleaseOutput(output: string): RollingRelease {
  const start = output.indexOf("{")
  const end = output.lastIndexOf("}")
  if (start === -1 || end < start) {
    throw new Error("saída do vercel rolling-release fetch sem JSON")
  }
  return JSON.parse(output.slice(start, end + 1)) as RollingRelease
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
  if (isCanary && FAILED_CANARY_READY_STATES.has((release.canaryDeployment?.readyState ?? "").toUpperCase())) {
    return { kind: "failed", detail: `deployment canary ${target} terminou ${release.canaryDeployment?.readyState}` }
  }
  if (state === "COMPLETE" && (isCanary || isCurrent)) {
    return { kind: "complete", detail: `rolling release COMPLETE em ${target}` }
  }
  if (state !== "" && !IN_PROGRESS_STATES.has(state)) {
    return {
      kind: "pending",
      detail: `estado desconhecido ${state} (esperado ${KNOWN_STATES_LABEL})`,
    }
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

  return {
    kind: "failed",
    detail: `tempo esgotado sem COMPLETE (estados conhecidos: ${KNOWN_STATES_LABEL}); última leitura: ${last.detail}`,
  }
}

export function redactSecret(text: string, secret: string): string {
  return secret ? text.split(secret).join("***") : text
}
