import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

describe("submission/progress Radar via fila", () => {
  it("PublicFormSubmissionUseCase não usa after()/syncPublicFormMetricToRadarInline", () => {
    const src = readFileSync(join(import.meta.dir, "PublicFormSubmissionUseCase.ts"), "utf8")
    expect(src).not.toContain("syncPublicFormMetricToRadarInline")
    expect(src).not.toContain('from "next/server"')
    expect(src).toContain("publishServerPublicFormMetricEvent")
  })

  it("PublicFormProgressUseCase não usa after()/syncPublicFormMetricToRadarInline", () => {
    const src = readFileSync(join(import.meta.dir, "PublicFormProgressUseCase.ts"), "utf8")
    expect(src).not.toContain("syncPublicFormMetricToRadarInline")
    expect(src).not.toContain('from "next/server"')
    expect(src).toContain("publishServerPublicFormMetricEvent")
    expect(src).not.toContain("CreateCrmLeadFromRadarFormGateUseCase")
    expect(src).not.toContain("upsertLeadFromFormAnswers")
  })
})
