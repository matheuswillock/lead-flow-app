import { describe, expect, it, mock } from "bun:test"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  assertApprovedPublicFormLeadBackfillFixture,
  namesMatchForBackfill,
  parsePublicFormLeadBackfillArgs,
  PUBLIC_FORM_LEAD_BACKFILL_EXCLUDED_PREFIXES,
  PUBLIC_FORM_LEAD_BACKFILL_PREFIXES,
  resolvePublicFormLeadBackfillAction,
  runPublicFormLeadBackfill,
  type PublicFormLeadBackfillCandidate,
  type PublicFormLeadBackfillCase,
  type PublicFormLeadBackfillFixture,
} from "./backfill-public-form-leads-ac"

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../scripts/fixtures/public-form-leads-ac.json",
)

function loadFixture(): PublicFormLeadBackfillFixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as PublicFormLeadBackfillFixture
}

function fixtureCase(overrides: Partial<PublicFormLeadBackfillCase> = {}): PublicFormLeadBackfillCase {
  return {
    id: 2,
    submissionPrefix: "7a147f9b",
    expectedName: "Sandra",
    gateReason: "single_name_mobile_and_email",
    ...overrides,
  }
}

function candidate(
  overrides: Partial<PublicFormLeadBackfillCandidate<string>> = {},
): PublicFormLeadBackfillCandidate<string> {
  return {
    fixtureCase: fixtureCase(),
    submissionIds: ["7a147f9b-0000-4000-8000-000000000002"],
    teamName: "MultiSkill",
    existingLeadId: null,
    extractedName: "Sandra",
    passesGate: true,
    matchingLeadId: null,
    payload: "payload",
    ...overrides,
  }
}

describe("backfill-public-form-leads-ac", () => {
  it("fixture aprovada tem só os 7 prefixos MultiSkill e exclui #8–#10", () => {
    const fixture = loadFixture()
    expect(() => assertApprovedPublicFormLeadBackfillFixture(fixture)).not.toThrow()
    expect(fixture.cases.map((item) => item.submissionPrefix)).toEqual([
      ...PUBLIC_FORM_LEAD_BACKFILL_PREFIXES,
    ])
    expect(fixture.excludedPrefixes).toEqual([...PUBLIC_FORM_LEAD_BACKFILL_EXCLUDED_PREFIXES])
    expect(fixture.cases[0]?.expectedName).toBe("Alexandre Barros Tavares")
    expect(fixture.cases[6]?.expectedName).toBe("Carlos")
  })

  it("parseia dry-run por padrão e --apply só quando pedido", () => {
    expect(parsePublicFormLeadBackfillArgs([])).toEqual({ apply: false })
    expect(parsePublicFormLeadBackfillArgs(["--apply"])).toEqual({ apply: true })
  })

  it("casa nome completo e primeiro nome da fixture", () => {
    expect(namesMatchForBackfill("Alexandre Barros Tavares", "Alexandre Barros Tavares")).toBe(
      true,
    )
    expect(namesMatchForBackfill("Sandra Cristina", "Sandra")).toBe(true)
    expect(namesMatchForBackfill("Carlos", "Carlos")).toBe(true)
    expect(namesMatchForBackfill("Ricardo Martins", "Sandra")).toBe(false)
  })

  it("decide create, attach e skips sem escrever", () => {
    expect(
      resolvePublicFormLeadBackfillAction({
        submissionIds: [],
        teamName: "MultiSkill",
        expectedTeamNameContains: "MultiSkill",
        existingLeadId: null,
        extractedName: "Sandra",
        expectedName: "Sandra",
        passesGate: true,
        matchingLeadId: null,
      }),
    ).toBe("skip_missing_submission")

    expect(
      resolvePublicFormLeadBackfillAction({
        submissionIds: ["a", "b"],
        teamName: "MultiSkill",
        expectedTeamNameContains: "MultiSkill",
        existingLeadId: null,
        extractedName: "Sandra",
        expectedName: "Sandra",
        passesGate: true,
        matchingLeadId: null,
      }),
    ).toBe("skip_ambiguous_prefix")

    expect(
      resolvePublicFormLeadBackfillAction({
        submissionIds: ["sub-1"],
        teamName: "Meu studio",
        expectedTeamNameContains: "MultiSkill",
        existingLeadId: null,
        extractedName: "Sandra",
        expectedName: "Sandra",
        passesGate: true,
        matchingLeadId: null,
      }),
    ).toBe("skip_wrong_team")

    expect(
      resolvePublicFormLeadBackfillAction({
        submissionIds: ["sub-1"],
        teamName: "MultiSkill",
        expectedTeamNameContains: "MultiSkill",
        existingLeadId: "lead-existing",
        extractedName: "Sandra",
        expectedName: "Sandra",
        passesGate: true,
        matchingLeadId: null,
      }),
    ).toBe("skip_already_attached")

    expect(
      resolvePublicFormLeadBackfillAction({
        submissionIds: ["sub-1"],
        teamName: "MultiSkill",
        expectedTeamNameContains: "MultiSkill",
        existingLeadId: null,
        extractedName: "Outro Nome",
        expectedName: "Sandra",
        passesGate: true,
        matchingLeadId: null,
      }),
    ).toBe("skip_name_mismatch")

    expect(
      resolvePublicFormLeadBackfillAction({
        submissionIds: ["sub-1"],
        teamName: "MultiSkill",
        expectedTeamNameContains: "MultiSkill",
        existingLeadId: null,
        extractedName: "Sandra",
        expectedName: "Sandra",
        passesGate: false,
        matchingLeadId: null,
      }),
    ).toBe("skip_gate")

    expect(
      resolvePublicFormLeadBackfillAction({
        submissionIds: ["sub-1"],
        teamName: "MultiSkill",
        expectedTeamNameContains: "MultiSkill",
        existingLeadId: null,
        extractedName: "Sandra",
        expectedName: "Sandra",
        passesGate: true,
        matchingLeadId: "lead-match",
      }),
    ).toBe("attach")

    expect(
      resolvePublicFormLeadBackfillAction({
        submissionIds: ["sub-1"],
        teamName: "MultiSkill",
        expectedTeamNameContains: "MultiSkill",
        existingLeadId: null,
        extractedName: "Alexandre Barros Tavares",
        expectedName: "Alexandre Barros Tavares",
        passesGate: true,
        matchingLeadId: null,
      }),
    ).toBe("create")
  })

  it("dry-run conta create/attach sem chamar applyLead", async () => {
    const applyLead = mock(async () => "lead-1")
    const result = await runPublicFormLeadBackfill({
      apply: false,
      expectedTeamNameContains: "MultiSkill",
      candidates: [
        candidate(),
        candidate({
          fixtureCase: fixtureCase({
            id: 1,
            submissionPrefix: "d2c5e0d3",
            expectedName: "Alexandre Barros Tavares",
            gateReason: "complete_name_and_landline",
          }),
          submissionIds: ["d2c5e0d3-0000-4000-8000-000000000001"],
          extractedName: "Alexandre Barros Tavares",
          matchingLeadId: "lead-match",
        }),
        candidate({
          existingLeadId: "already",
          extractedName: "Sandra",
        }),
      ],
      applyLead,
    })

    expect(result.mode).toBe("dry-run")
    expect(result.wouldCreate).toBe(1)
    expect(result.wouldAttach).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.created).toBe(0)
    expect(result.attached).toBe(0)
    expect(applyLead).not.toHaveBeenCalled()
  })

  it("apply grava só create/attach e isola falha por caso", async () => {
    const applyLead = mock(async (item: PublicFormLeadBackfillCandidate<string>) => {
      if (item.fixtureCase.id === 2) throw new Error("banco indisponível")
      return `lead-${item.fixtureCase.id}`
    })

    const result = await runPublicFormLeadBackfill({
      apply: true,
      expectedTeamNameContains: "MultiSkill",
      candidates: [
        candidate({
          fixtureCase: fixtureCase({
            id: 1,
            submissionPrefix: "d2c5e0d3",
            expectedName: "Alexandre Barros Tavares",
            gateReason: "complete_name_and_landline",
          }),
          submissionIds: ["d2c5e0d3-0000-4000-8000-000000000001"],
          extractedName: "Alexandre Barros Tavares",
        }),
        candidate(),
      ],
      applyLead,
    })

    expect(result.mode).toBe("apply")
    expect(result.created).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.rows[1]?.error).toBe("banco indisponível")
    expect(applyLead).toHaveBeenCalledTimes(2)
  })
})
