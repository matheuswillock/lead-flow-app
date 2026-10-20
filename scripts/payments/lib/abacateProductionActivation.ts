import type { ProviderRolloutState } from "@/lib/payment-provider/routing"
import type {
  ProviderRoutingConfigPatch,
  ProviderRoutingConfigRecord,
} from "@/lib/payment-provider/routing-config"

export const ABACATE_PRODUCTION_ACCOUNT_CONTEXT = "abacate-production"

const ROLLOUT_SEQUENCE: readonly ProviderRolloutState[] = [
  "DISABLED",
  "SANDBOX_VALIDATED",
  "APPROVED",
  "ACTIVE",
]

export type ActivationArgs = {
  readonly apply: boolean
  readonly expectedRevision: number
}

export type ActivationDependencies = {
  getConfig(): Promise<ProviderRoutingConfigRecord | null>
  applyPatch(patch: ProviderRoutingConfigPatch): Promise<ProviderRoutingConfigRecord>
}

export type ActivationResult = {
  readonly ok: boolean
  readonly applied: boolean
  readonly plannedSteps: readonly ProviderRoutingConfigPatch[]
  readonly finalState: ProviderRoutingConfigRecord | null
  readonly error?: string
}

export function parseActivationArgs(argv: readonly string[]): ActivationArgs {
  const revisionArg = argv.find((arg) => arg.startsWith("--expected-revision="))
  const revision = Number(revisionArg?.split("=")[1])
  if (!revisionArg || !Number.isInteger(revision) || revision < 1) {
    throw new Error("--expected-revision=<inteiro> é obrigatório")
  }
  return { apply: argv.includes("--apply"), expectedRevision: revision }
}

export async function runAbacateProductionActivation(
  args: ActivationArgs,
  dependencies: ActivationDependencies,
): Promise<ActivationResult> {
  const current = await dependencies.getConfig()
  const refusal = current ? findPreconditionFailure(current, args) : "Configuração não encontrada"
  if (!current || refusal) return failure(refusal ?? "Configuração não encontrada", [], current)

  const plannedSteps = planSteps(current)
  if (!args.apply) {
    return { ok: true, applied: false, plannedSteps, finalState: current }
  }
  return applySteps(plannedSteps, dependencies, current)
}

function findPreconditionFailure(
  current: ProviderRoutingConfigRecord,
  args: ActivationArgs,
): string | null {
  if (current.revision !== args.expectedRevision) {
    return `A revisão atual (${current.revision}) difere da esperada (${args.expectedRevision})`
  }
  if (current.killSwitch) return "O kill switch está ligado; desligue-o antes de ativar"
  if (current.externalAccountContext !== ABACATE_PRODUCTION_ACCOUNT_CONTEXT) {
    return `O contexto da conta deve ser ${ABACATE_PRODUCTION_ACCOUNT_CONTEXT}; trocá-lo zera a saúde`
  }
  if (current.healthStatus !== "HEALTHY") {
    return `O health-check precisa estar HEALTHY (atual: ${current.healthStatus})`
  }
  return null
}

function planSteps(current: ProviderRoutingConfigRecord): ProviderRoutingConfigPatch[] {
  const currentIndex = ROLLOUT_SEQUENCE.indexOf(current.rolloutState)
  const remaining = ROLLOUT_SEQUENCE.slice(currentIndex + 1)
  const needsFinalFlags = !current.enabled || !current.isDefault
  const targets = remaining.length === 0 && needsFinalFlags ? ["ACTIVE" as const] : remaining
  return targets.map((rolloutState, index) => buildStep(rolloutState, current.revision + index))
}

function buildStep(
  rolloutState: ProviderRolloutState,
  expectedRevision: number,
): ProviderRoutingConfigPatch {
  const isFinal = rolloutState === "ACTIVE"
  return {
    expectedRevision,
    rolloutState,
    externalAccountContext: ABACATE_PRODUCTION_ACCOUNT_CONTEXT,
    ...(isFinal ? { enabled: true, isDefault: true } : {}),
  }
}

async function applySteps(
  steps: readonly ProviderRoutingConfigPatch[],
  dependencies: ActivationDependencies,
  initial: ProviderRoutingConfigRecord,
): Promise<ActivationResult> {
  let state = initial
  for (const step of steps) {
    try {
      state = await dependencies.applyPatch({ ...step, expectedRevision: state.revision })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao aplicar o passo"
      return failure(`Passo ${step.rolloutState} falhou: ${message}`, steps, state)
    }
  }
  return { ok: true, applied: true, plannedSteps: steps, finalState: state }
}

function failure(
  error: string,
  plannedSteps: readonly ProviderRoutingConfigPatch[],
  finalState: ProviderRoutingConfigRecord | null,
): ActivationResult {
  return { ok: false, applied: false, plannedSteps, finalState, error }
}
