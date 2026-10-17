import { describe, expect, it } from "bun:test"
import { buildFormDomainDnsRecords } from "./form-domain-dns-records"

describe("buildFormDomainDnsRecords", () => {
  it("usa o CNAME recomendado pela Vercel quando ele está disponível", () => {
    const [record] = buildFormDomainDnsRecords({
      hostname: "studio.evouscorretora.com.br",
      apexName: "evouscorretora.com.br",
      cnameTarget: "e7ec430d41e066d4.vercel-dns-017.com.",
    })

    expect(record?.value).toBe("e7ec430d41e066d4.vercel-dns-017.com.")
  })
})
