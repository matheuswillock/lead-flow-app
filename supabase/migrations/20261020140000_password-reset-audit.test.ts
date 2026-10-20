import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"

const migration = readFileSync(
  new URL("./20261020140000_password-reset-audit.sql", import.meta.url),
  "utf8",
)

const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8")

function fieldLines(source: string): string[] {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("///"))
}

describe("password reset audit persistence contract", () => {
  it("correlates every audit event to its parent flow", () => {
    expect(migration).toContain('"flowId" uuid not null')
    expect(migration).toContain('foreign key ("flowId")')
    expect(migration).toContain('references "public"."password_reset_flows"("id")')
    expect(migration).toContain("on delete cascade")
    expect(migration).toContain('on "public"."password_reset_events" ("flowId", "occurredAt" desc)')

    const flowModel = schema.slice(
      schema.indexOf("model PasswordResetFlow"),
      schema.indexOf("model HealthPlanOption"),
    )
    expect(flowModel).toContain("events  PasswordResetEvent[]")
    expect(flowModel).toContain(
      "flow PasswordResetFlow @relation(fields: [flowId], references: [id], onDelete: Cascade)",
    )
  })

  it("keeps the IP contract hashed and retains only diagnostic context", () => {
    expect(migration).toContain('"ipHash" text')
    expect(migration).toContain('"userAgent" text')
    expect(migration).toContain('"originScreen" text')
    expect(migration).not.toMatch(/"ip"\s+text/)

    const auditModel = schema.slice(
      schema.indexOf("model PasswordResetFlow"),
      schema.indexOf("model HealthPlanOption"),
    )
    expect(auditModel).toContain("ipHash")
    expect(auditModel).not.toMatch(/^ip\s+/m)
  })

  it("does not add token, password, action URL, or raw provider payload fields", () => {
    const migrationFields = fieldLines(migration)
    const schemaFields = fieldLines(
      schema.slice(
        schema.indexOf("model PasswordResetFlow"),
        schema.indexOf("model HealthPlanOption"),
      ),
    )
    const forbiddenField =
      /^(?:token|tokenHash|password|actionUrl|rawUrl|payload|providerPayload)$/i

    const migrationColumnNames = migrationFields
      .map((line) => line.match(/^"([^"]+)"/)?.[1])
      .filter((name): name is string => Boolean(name))
    const schemaColumnNames = schemaFields
      .map((line) => line.match(/^([A-Za-z_]+)\s+/)?.[1])
      .filter((name): name is string => Boolean(name))

    expect(migrationColumnNames.filter((name) => forbiddenField.test(name))).toEqual([])
    expect(schemaColumnNames.filter((name) => forbiddenField.test(name))).toEqual([])
  })

  it("supports explicit expiry and rejection reasons without persisting secrets", () => {
    expect(migration).toContain('"expiresAt" timestamptz(6)')
    expect(migration).toContain('"failureCode" text')
    expect(migration).toContain("'verification_pending'")
    expect(migration).toContain("'email_delivered'")
    expect(migration).toContain("'email_opened'")
    expect(migration).toContain("'email_clicked'")
    expect(migration).toContain("'page_opened'")
    expect(migration).toContain("'verification_started'")
    expect(migration).toContain("'password_update_failed'")
    expect(migration).toContain("'token_rejected'")
    expect(migration).toContain("'expired'")
  })
})
