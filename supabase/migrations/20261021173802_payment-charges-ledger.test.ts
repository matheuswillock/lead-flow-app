import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const sql = readFileSync(join(import.meta.dir, "20261021173802_payment-charges-ledger.sql"), "utf8")
const code = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")

function block(startMarker: string): string {
  const start = code.indexOf(startMarker)
  expect(start).toBeGreaterThan(-1)
  return code.slice(start, code.indexOf(");", start))
}

describe("contrato da migration do ledger: histórico financeiro sobrevive à exclusão da conta", () => {
  const charges = block('CREATE TABLE IF NOT EXISTS "public"."payment_charges"')

  it("profile_id é anulável e o FK do perfil é ON DELETE SET NULL (nunca CASCADE nem RESTRICT)", () => {
    expect(charges).toMatch(/"profile_id" UUID,/)
    expect(charges).not.toMatch(/"profile_id" UUID NOT NULL/)
    const fk = /"payment_charges_profile_id_fkey"\s+FOREIGN KEY \("profile_id"\)[^,]*?ON DELETE (\w+(?: \w+)?)/.exec(charges)
    expect(fk?.[1]).toBe("SET NULL")
  })

  it("profile_ref guarda a cópia imutável do id, NOT NULL e sem FK", () => {
    expect(charges).toMatch(/"profile_ref" UUID NOT NULL/)
    expect(charges).not.toMatch(/FOREIGN KEY \("profile_ref"\)/)
  })

  it("a idempotência é por profile_ref, que não zera quando o perfil é apagado", () => {
    expect(code).toMatch(/UNIQUE INDEX IF NOT EXISTS "payment_charges_profile_ref_idempotency_key"\s+ON "public"\."payment_charges" \("profile_ref", "idempotency_key"\)/)
    expect(code).not.toMatch(/\("profile_id", "idempotency_key"\)/)
  })

  it("a cobrança nunca é apagada junto com o perfil nem com os eventos: FK dos eventos é RESTRICT", () => {
    const events = block('CREATE TABLE IF NOT EXISTS "public"."payment_charge_events"')
    expect(events).toMatch(/"payment_charge_events_charge_id_fkey"[\s\S]*ON DELETE RESTRICT/)
  })

  it("nenhum FK de payment_charges apaga a cobrança em cascata a partir do perfil", () => {
    expect(charges).not.toMatch(/REFERENCES "public"\."corretor_studio_profiles"[^,]*ON DELETE (CASCADE|RESTRICT)/)
  })
})
