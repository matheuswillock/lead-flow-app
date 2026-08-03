import { describe, expect, it } from "bun:test"
import {
  RADAR_EXPORT_COLUMNS,
  RADAR_EXPORT_MAX_ROWS,
  buildRadarExportCsv,
  buildRadarExportExcel,
  buildRadarExportRows,
  capRadarExportRows,
  formatRadarExportIdentities,
} from "@/lib/radar/exportRadarProfiles"
import { LEAD_IMPORT_MAX_ROWS } from "@/lib/leadImport/leadImportFields"

describe("exportRadarProfiles", () => {
  it("reusa o cap de linhas do CRM", () => {
    expect(RADAR_EXPORT_MAX_ROWS).toBe(LEAD_IMPORT_MAX_ROWS)
    expect(RADAR_EXPORT_MAX_ROWS).toBe(2000)
  })

  it("monta colunas corretas do Radar (perfil, identidades, último evento)", () => {
    const rows = buildRadarExportRows([
      {
        displayName: "Ana Silva",
        primaryEmail: "ana@example.com",
        displayPhone: "11999990000",
        primaryDocument: "12345678901",
        lastSeenAt: "2026-08-01T12:00:00.000Z",
        identities: [
          { type: "email", value: "ana@example.com", normalizedValue: "ana@example.com" },
          { type: "phone", value: "11999990000", normalizedValue: "5511999990000" },
        ],
        lastEvent: { eventType: "email.opened", occurredAt: "2026-08-01T11:00:00.000Z" },
      },
    ])

    expect(Object.keys(rows[0]!)).toEqual([...RADAR_EXPORT_COLUMNS])
    expect(rows[0]).toEqual({
      Perfil: "Ana Silva",
      "E-mail": "ana@example.com",
      Telefone: "11999990000",
      Documento: "12345678901",
      Identidades: "email:ana@example.com; phone:11999990000",
      "Último evento": "email.opened",
      "Data do último evento": "2026-08-01T11:00:00.000Z",
      "Última interação": "2026-08-01T12:00:00.000Z",
    })
  })

  it("formata identidades e faz escaping de CSV com vírgulas e aspas", () => {
    expect(
      formatRadarExportIdentities([
        { type: "email", value: null, normalizedValue: "fallback@x.com" },
      ])
    ).toBe("email:fallback@x.com")

    const rows = buildRadarExportRows([
      {
        displayName: 'Empresa "ACME", Ltda',
        primaryEmail: "a,b@example.com",
        displayPhone: null,
        primaryDocument: null,
        lastSeenAt: null,
        identities: [{ type: "lead_id", value: "id,1", normalizedValue: "id,1" }],
        lastEvent: null,
      },
    ])

    const csv = buildRadarExportCsv(rows)
    expect(typeof csv.content).toBe("string")
    const content = csv.content as string
    expect(content.startsWith("\uFEFF")).toBe(true)
    expect(content).toContain('"Empresa ""ACME"", Ltda"')
    expect(content).toContain('"a,b@example.com"')
    expect(content).toContain('"lead_id:id,1"')
    expect(csv.fileName).toBe("radar-perfis.csv")
  })

  it("gera Excel com payload binário", () => {
    const rows = buildRadarExportRows([
      {
        displayName: "Bruno",
        primaryEmail: null,
        displayPhone: "11988887777",
        primaryDocument: null,
        lastSeenAt: new Date("2026-07-01T00:00:00.000Z"),
        identities: [],
        lastEvent: {
          eventType: "whatsapp.message_received",
          occurredAt: new Date("2026-07-01T00:00:00.000Z"),
        },
      },
    ])

    const excel = buildRadarExportExcel(rows, "radar-segmento")
    expect(excel.fileName).toBe("radar-segmento.xlsx")
    expect(excel.contentType).toContain("spreadsheetml")
    expect(excel.content).toBeInstanceOf(ArrayBuffer)
    expect((excel.content as ArrayBuffer).byteLength).toBeGreaterThan(0)
  })

  it("aplica cap de linhas sem inventar limite novo", () => {
    const input = Array.from({ length: RADAR_EXPORT_MAX_ROWS + 5 }, (_, i) => i)
    const capped = capRadarExportRows(input)
    expect(capped.truncated).toBe(true)
    expect(capped.rows).toHaveLength(RADAR_EXPORT_MAX_ROWS)

    const small = capRadarExportRows([1, 2, 3])
    expect(small.truncated).toBe(false)
    expect(small.rows).toEqual([1, 2, 3])
  })
})
