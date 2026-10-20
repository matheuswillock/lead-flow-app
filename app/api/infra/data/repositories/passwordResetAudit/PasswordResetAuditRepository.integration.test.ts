import { afterAll, describe, expect, it } from "bun:test"
import { randomUUID } from "node:crypto"

const RUN_INTEGRATION =
  process.env.PASSWORD_RESET_AUDIT_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? ""
  if (!/@(127\.0\.0\.1|localhost|host\.docker\.internal)[:/]/.test(url)) {
    throw new Error(
      "[integration] abortado: password reset audit tests only write to a local DATABASE_URL",
    )
  }
}

let prisma: typeof import("@/app/api/infra/data/prisma").prisma

if (RUN_INTEGRATION) {
  assertLocalDatabase()
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip
const testRecipientPrefix = "test-password-reset-audit:"
const flowIds: string[] = []

describeIntegration("password reset audit — Postgres integration", () => {
  afterAll(async () => {
    if (!RUN_INTEGRATION) return

    await prisma.$executeRaw`
      delete from password_reset_events
      where "flowId" = any(${flowIds}::uuid[])
    `
    await prisma.$executeRaw`
      delete from password_reset_flows
      where "recipientEmail" like ${`${testRecipientPrefix}%`}
    `
    await prisma.$disconnect()
  })

  it("keeps one flow correlation id across the expanded audit event lifecycle", async () => {
    const flowId = randomUUID()
    flowIds.push(flowId)

    await prisma.$executeRaw`
      insert into password_reset_flows
        ("id", "recipientEmail", "status", "ipHash", "userAgent", "originScreen", "failureCode", "updatedAt")
      values
        (${flowId}::uuid, ${`${testRecipientPrefix}${flowId}@example.test`},
         ${"verification_pending"}::password_reset_flow_status, ${"sha256:test-ip"},
         ${"test-agent"}, ${"forgot-password"}, ${"otp_expired"}, now())
    `

    await prisma.$executeRaw`
      insert into password_reset_events ("flowId", "type", "failureCode", "ipHash")
      values
        (${flowId}::uuid, ${"requested"}::password_reset_event_type, null, ${"sha256:test-ip"}),
        (${flowId}::uuid, ${"email_delivered"}::password_reset_event_type, null, null),
        (${flowId}::uuid, ${"email_opened"}::password_reset_event_type, null, null),
        (${flowId}::uuid, ${"email_clicked"}::password_reset_event_type, null, null),
        (${flowId}::uuid, ${"page_opened"}::password_reset_event_type, null, null),
        (${flowId}::uuid, ${"verification_started"}::password_reset_event_type, null, null),
        (${flowId}::uuid, ${"token_rejected"}::password_reset_event_type, ${"otp_expired"}, null),
        (${flowId}::uuid, ${"password_update_failed"}::password_reset_event_type, ${"otp_expired"}, null)
    `

    const events = await prisma.$queryRaw<
      Array<{ flowId: string; type: string; failureCode: string | null; ipHash: string | null }>
    >`
      select "flowId", type::text, "failureCode", "ipHash"
      from password_reset_events
      where "flowId" = ${flowId}::uuid
      order by "occurredAt" asc
    `
    const [flow] = await prisma.$queryRaw<Array<{ status: string; ipHash: string | null }>>`
      select status::text, "ipHash"
      from password_reset_flows
      where id = ${flowId}::uuid
    `

    expect(events).toHaveLength(8)
    expect(flow?.status).toBe("verification_pending")
    expect(flow?.ipHash).toBe("sha256:test-ip")
    expect(new Set(events.map((event) => event.flowId))).toEqual(new Set([flowId]))
    expect(events.map((event) => event.type)).toEqual([
      "requested",
      "email_delivered",
      "email_opened",
      "email_clicked",
      "page_opened",
      "verification_started",
      "token_rejected",
      "password_update_failed",
    ])
    expect(events[6]?.failureCode).toBe("otp_expired")
    expect(events[0]?.ipHash).toBe("sha256:test-ip")
  })

  it("does not expose secret-bearing columns in the audit tables", async () => {
    const columns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('password_reset_flows', 'password_reset_events')
    `

    const columnNames = columns.map(({ column_name: columnName }) => columnName)
    expect(columnNames).toContain("ipHash")
    expect(columnNames).not.toContain("token")
    expect(columnNames).not.toContain("tokenHash")
    expect(columnNames).not.toContain("password")
    expect(columnNames).not.toContain("actionUrl")
    expect(columnNames).not.toContain("payload")
  })
})
