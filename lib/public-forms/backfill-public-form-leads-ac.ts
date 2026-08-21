export const PUBLIC_FORM_LEAD_BACKFILL_PREFIXES = [
  "d2c5e0d3",
  "7a147f9b",
  "c0fd0f05",
  "71c71cbd",
  "b3b714e7",
  "84fa96b4",
  "f718e75e",
] as const

export const PUBLIC_FORM_LEAD_BACKFILL_EXCLUDED_PREFIXES = [
  "86c27c79",
  "d6a7d1d1",
  "4978ea92",
] as const

export type PublicFormLeadBackfillGateReason =
  | "complete_name_and_landline"
  | "single_name_mobile_and_email"

export type PublicFormLeadBackfillCase = {
  id: number
  submissionPrefix: string
  expectedName: string
  gateReason: PublicFormLeadBackfillGateReason
}

export type PublicFormLeadBackfillFixture = {
  description: string
  expectedTeamNameContains: string
  excludedPrefixes: string[]
  cases: PublicFormLeadBackfillCase[]
}

export type PublicFormLeadBackfillAction =
  | "create"
  | "attach"
  | "skip_already_attached"
  | "skip_missing_submission"
  | "skip_ambiguous_prefix"
  | "skip_wrong_team"
  | "skip_name_mismatch"
  | "skip_gate"

export type PublicFormLeadBackfillDecisionInput = {
  submissionIds: string[]
  teamName: string | null
  expectedTeamNameContains: string
  existingLeadId: string | null
  extractedName: string
  expectedName: string
  passesGate: boolean
  matchingLeadId: string | null
}

export type PublicFormLeadBackfillCandidate<TPayload = unknown> = {
  fixtureCase: PublicFormLeadBackfillCase
  submissionIds: string[]
  teamName: string | null
  existingLeadId: string | null
  extractedName: string
  passesGate: boolean
  matchingLeadId: string | null
  payload: TPayload
}

export type PublicFormLeadBackfillRowResult = {
  id: number
  submissionPrefix: string
  expectedName: string
  extractedName: string
  action: PublicFormLeadBackfillAction
  submissionId: string | null
  leadId: string | null
  error?: string
}

export type PublicFormLeadBackfillRunResult = {
  mode: "dry-run" | "apply"
  total: number
  wouldCreate: number
  wouldAttach: number
  created: number
  attached: number
  skipped: number
  failed: number
  rows: PublicFormLeadBackfillRowResult[]
}

export type PublicFormLeadBackfillRunnerDeps<TPayload> = {
  apply: boolean
  expectedTeamNameContains: string
  candidates: Array<PublicFormLeadBackfillCandidate<TPayload>>
  applyLead: (candidate: PublicFormLeadBackfillCandidate<TPayload>) => Promise<string>
  repairAlreadyAttached?: (
    candidate: PublicFormLeadBackfillCandidate<TPayload>,
  ) => Promise<void>
}

const SKIP_ACTIONS = new Set<PublicFormLeadBackfillAction>([
  "skip_already_attached",
  "skip_missing_submission",
  "skip_ambiguous_prefix",
  "skip_wrong_team",
  "skip_name_mismatch",
  "skip_gate",
])

export function parsePublicFormLeadBackfillArgs(argv: string[]): { apply: boolean } {
  return { apply: argv.includes("--apply") }
}

export function normalizeBackfillPersonName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

export function resolveBackfillMetricSessionId(input: {
  visitorSessionId: string | null
  requestKey: string
}): string {
  return (input.visitorSessionId ?? input.requestKey).slice(0, 100)
}

export function namesMatchForBackfill(extractedName: string, expectedName: string): boolean {
  const extracted = normalizeBackfillPersonName(extractedName)
  const expected = normalizeBackfillPersonName(expectedName)
  if (!extracted || !expected) return false
  if (extracted === expected) return true
  if (extracted.startsWith(`${expected} `)) return true

  const expectedWords = expected.split(" ")
  const extractedFirst = extracted.split(" ")[0]
  return expectedWords.length === 1 && extractedFirst === expected
}

export function resolvePublicFormLeadBackfillAction(
  input: PublicFormLeadBackfillDecisionInput,
): PublicFormLeadBackfillAction {
  if (input.submissionIds.length === 0) return "skip_missing_submission"
  if (input.submissionIds.length > 1) return "skip_ambiguous_prefix"

  const teamName = input.teamName?.trim() ?? ""
  if (!teamName.toLowerCase().includes(input.expectedTeamNameContains.trim().toLowerCase())) {
    return "skip_wrong_team"
  }

  if (input.existingLeadId) return "skip_already_attached"
  if (!namesMatchForBackfill(input.extractedName, input.expectedName)) {
    return "skip_name_mismatch"
  }
  if (!input.passesGate) return "skip_gate"
  if (input.matchingLeadId) return "attach"
  return "create"
}

export function assertApprovedPublicFormLeadBackfillFixture(
  fixture: PublicFormLeadBackfillFixture,
): void {
  if (fixture.expectedTeamNameContains.trim().toLowerCase() !== "multiskill") {
    throw new Error("Fixture deve apontar só para o time MultiSkill")
  }

  const prefixes = fixture.cases.map((item) => item.submissionPrefix)
  if (prefixes.length !== PUBLIC_FORM_LEAD_BACKFILL_PREFIXES.length) {
    throw new Error(
      `Fixture deve ter ${PUBLIC_FORM_LEAD_BACKFILL_PREFIXES.length} casos; veio ${prefixes.length}`,
    )
  }

  for (const [index, prefix] of PUBLIC_FORM_LEAD_BACKFILL_PREFIXES.entries()) {
    if (prefixes[index] !== prefix) {
      throw new Error(`Prefixo #${index + 1} esperado ${prefix}, veio ${prefixes[index]}`)
    }
  }

  const excluded = new Set(
    fixture.excludedPrefixes.concat([...PUBLIC_FORM_LEAD_BACKFILL_EXCLUDED_PREFIXES]),
  )
  for (const prefix of prefixes) {
    if (excluded.has(prefix)) {
      throw new Error(`Prefixo excluído entrou no backfill: ${prefix}`)
    }
  }
}

function isSkipAction(action: PublicFormLeadBackfillAction): boolean {
  return SKIP_ACTIONS.has(action)
}

export async function runPublicFormLeadBackfill<TPayload>(
  deps: PublicFormLeadBackfillRunnerDeps<TPayload>,
): Promise<PublicFormLeadBackfillRunResult> {
  const result: PublicFormLeadBackfillRunResult = {
    mode: deps.apply ? "apply" : "dry-run",
    total: deps.candidates.length,
    wouldCreate: 0,
    wouldAttach: 0,
    created: 0,
    attached: 0,
    skipped: 0,
    failed: 0,
    rows: [],
  }

  for (const candidate of deps.candidates) {
    const action = resolvePublicFormLeadBackfillAction({
      submissionIds: candidate.submissionIds,
      teamName: candidate.teamName,
      expectedTeamNameContains: deps.expectedTeamNameContains,
      existingLeadId: candidate.existingLeadId,
      extractedName: candidate.extractedName,
      expectedName: candidate.fixtureCase.expectedName,
      passesGate: candidate.passesGate,
      matchingLeadId: candidate.matchingLeadId,
    })

    const row: PublicFormLeadBackfillRowResult = {
      id: candidate.fixtureCase.id,
      submissionPrefix: candidate.fixtureCase.submissionPrefix,
      expectedName: candidate.fixtureCase.expectedName,
      extractedName: candidate.extractedName,
      action,
      submissionId: candidate.submissionIds.length === 1 ? (candidate.submissionIds[0] ?? null) : null,
      leadId: candidate.existingLeadId ?? candidate.matchingLeadId,
    }

    if (action === "skip_already_attached" && deps.apply && deps.repairAlreadyAttached) {
      try {
        await deps.repairAlreadyAttached(candidate)
        result.skipped += 1
      } catch (error) {
        result.failed += 1
        row.error = error instanceof Error ? error.message : "Falha ao reparar métrica do backfill"
      }
      result.rows.push(row)
      continue
    }

    if (isSkipAction(action)) {
      result.skipped += 1
      result.rows.push(row)
      continue
    }

    if (!deps.apply) {
      if (action === "create") result.wouldCreate += 1
      if (action === "attach") result.wouldAttach += 1
      result.rows.push(row)
      continue
    }

    try {
      const leadId = await deps.applyLead(candidate)
      row.leadId = leadId
      if (action === "create") result.created += 1
      if (action === "attach") result.attached += 1
    } catch (error) {
      result.failed += 1
      row.error = error instanceof Error ? error.message : "Falha ao aplicar backfill"
    }

    result.rows.push(row)
  }

  return result
}
