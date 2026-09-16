import { describe, expect, it } from "bun:test"
import {
  buildDnsInstructionsAgentPrompt,
  buildDnsInstructionsEmailContent,
  buildDnsInstructionsText,
  groupDnsRecordsBySection,
  isDnsRecordVerified,
  type CustomDomainDnsRecord,
} from "./custom-domain-dns-instructions"

const DOMAIN_NAME = "mail.imobiliaria-exemplo.com.br"

const DKIM_RECORD: CustomDomainDnsRecord = {
  record: "DKIM",
  type: "TXT",
  name: "resend._domainkey",
  value: "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQChaveDkimExemplo",
  ttl: "Auto",
  status: "pending",
}

const SPF_MX_RECORD: CustomDomainDnsRecord = {
  record: "SPF",
  type: "MX",
  name: "send",
  value: "feedback-smtp.us-east-1.amazonses.com",
  priority: 10,
  ttl: "Auto",
  status: "pending",
}

const SPF_TXT_RECORD: CustomDomainDnsRecord = {
  record: "SPF",
  type: "TXT",
  name: "send",
  value: "v=spf1 include:amazonses.com ~all",
  ttl: "Auto",
  status: "verified",
}

const TRACKING_RECORD: CustomDomainDnsRecord = {
  record: "Tracking",
  type: "CNAME",
  name: "links",
  value: "custom-tracking.exemplo-provedor.com",
  ttl: "Auto",
  status: "not_started",
}

const ALL_RECORDS = [SPF_MX_RECORD, TRACKING_RECORD, DKIM_RECORD, SPF_TXT_RECORD]

describe("groupDnsRecordsBySection", () => {
  it("agrupa por seção na ordem DKIM, SPF, Tracking", () => {
    const sections = groupDnsRecordsBySection(ALL_RECORDS)
    expect(sections.map((section) => section.key)).toEqual(["dkim", "spf", "tracking"])
    expect(sections[1]?.records).toEqual([SPF_MX_RECORD, SPF_TXT_RECORD])
  })

  it("omite seções sem registros e junta desconhecidos em 'other'", () => {
    const unknown: CustomDomainDnsRecord = {
      record: "Custom",
      type: "TXT",
      name: "_custom",
      value: "abc",
      ttl: "Auto",
    }
    const sections = groupDnsRecordsBySection([DKIM_RECORD, unknown])
    expect(sections.map((section) => section.key)).toEqual(["dkim", "other"])
    expect(sections[1]?.records).toEqual([unknown])
  })
})

describe("isDnsRecordVerified", () => {
  it("só considera verificado o status 'verified'", () => {
    expect(isDnsRecordVerified(SPF_TXT_RECORD)).toBe(true)
    expect(isDnsRecordVerified(SPF_MX_RECORD)).toBe(false)
    expect(isDnsRecordVerified({ ...TRACKING_RECORD, status: undefined })).toBe(false)
  })
})

describe("buildDnsInstructionsText", () => {
  const text = buildDnsInstructionsText({ domainName: DOMAIN_NAME, records: ALL_RECORDS })

  it("abre com o cabeçalho do domínio e a instrução de cadastro", () => {
    expect(text).toContain(
      `Registros DNS para verificação do domínio ${DOMAIN_NAME} no Corretor Studio`
    )
    expect(text).toContain(
      `Cadastre os registros abaixo no gerenciador de DNS da hospedagem do domínio ${DOMAIN_NAME}:`
    )
  })

  it("lista as seções na ordem DKIM, Envio (SPF), Tracking", () => {
    const dkimIndex = text.indexOf("DKIM (verificação do domínio)")
    const spfIndex = text.indexOf("Envio (SPF)")
    const trackingIndex = text.indexOf("Tracking\n")
    expect(dkimIndex).toBeGreaterThan(-1)
    expect(spfIndex).toBeGreaterThan(dkimIndex)
    expect(trackingIndex).toBeGreaterThan(spfIndex)
  })

  it("gera cada linha a partir do registro real, com prioridade só quando existe", () => {
    expect(text).toContain(
      "Tipo: MX | Nome: send | Valor: feedback-smtp.us-east-1.amazonses.com | Prioridade: 10 | TTL: Auto"
    )
    expect(text).toContain(
      `Tipo: TXT | Nome: resend._domainkey | Valor: ${DKIM_RECORD.value} | TTL: Auto`
    )
    expect(text).not.toContain("Prioridade: undefined")
  })

  it("usa TTL Auto quando o registro não informa TTL", () => {
    const withoutTtl = buildDnsInstructionsText({
      domainName: DOMAIN_NAME,
      records: [{ ...DKIM_RECORD, ttl: undefined }],
    })
    expect(withoutTtl).toContain("TTL: Auto")
  })

  it("avisa sobre o proxy da Cloudflare e o passo final de verificação", () => {
    expect(text).toContain("nuvem laranja")
    expect(text).toContain('"DNS only" (nuvem cinza)')
    expect(text).toContain('clique em "Verificar DNS"')
  })

  it("não menciona o provedor de e-mail na narrativa", () => {
    expect(text).not.toMatch(/Resend/)
  })

  it("aponta o painel pelo nome quando a hospedagem é conhecida", () => {
    const withProvider = buildDnsInstructionsText({
      domainName: DOMAIN_NAME,
      records: ALL_RECORDS,
      providerName: "HostGator",
    })
    expect(withProvider).toContain(
      `Cadastre os registros abaixo no painel da HostGator, hospedagem de DNS do domínio ${DOMAIN_NAME}:`
    )
    expect(withProvider).not.toContain("gerenciador de DNS da hospedagem")
    expect(withProvider).not.toMatch(/Resend/)
  })

  it("mantém a narrativa genérica quando o provedor vem null", () => {
    const withoutProvider = buildDnsInstructionsText({
      domainName: DOMAIN_NAME,
      records: ALL_RECORDS,
      providerName: null,
    })
    expect(withoutProvider).toContain(
      `Cadastre os registros abaixo no gerenciador de DNS da hospedagem do domínio ${DOMAIN_NAME}:`
    )
  })

  it("sobe o aviso da nuvem laranja para o topo quando a hospedagem é a Cloudflare", () => {
    const cloudflare = buildDnsInstructionsText({
      domainName: DOMAIN_NAME,
      records: ALL_RECORDS,
      providerName: "Cloudflare",
    })
    const warningIndex = cloudflare.indexOf("nuvem laranja")
    const recordsIndex = cloudflare.indexOf("DKIM (verificação do domínio)")
    expect(warningIndex).toBeGreaterThan(-1)
    expect(warningIndex).toBeLessThan(recordsIndex)
    expect(cloudflare).toContain("o DNS deste domínio está na Cloudflare")
    // Uma vez só: com a hospedagem confirmada o aviso deixa de repetir no rodapé.
    expect(cloudflare.split("nuvem laranja")).toHaveLength(2)
  })

  it("mantém o aviso da nuvem laranja no rodapé para hospedagem que não é Cloudflare", () => {
    const hostgator = buildDnsInstructionsText({
      domainName: DOMAIN_NAME,
      records: ALL_RECORDS,
      providerName: "HostGator",
    })
    const warningIndex = hostgator.indexOf("nuvem laranja")
    const recordsIndex = hostgator.indexOf("DKIM (verificação do domínio)")
    expect(warningIndex).toBeGreaterThan(recordsIndex)
  })
})

describe("buildDnsInstructionsAgentPrompt", () => {
  const prompt = buildDnsInstructionsAgentPrompt({
    domainName: DOMAIN_NAME,
    records: ALL_RECORDS,
  })

  it("define a persona com acesso ao gerenciador de DNS do domínio", () => {
    expect(prompt).toContain(
      `Você tem acesso ao gerenciador de DNS da hospedagem do domínio ${DOMAIN_NAME}.`
    )
  })

  it("proíbe o proxy da Cloudflare e exige confirmação registro a registro", () => {
    expect(prompt).toContain("nuvem laranja")
    expect(prompt).toContain("um a um")
  })

  it("embute os registros reais do domínio", () => {
    expect(prompt).toContain(SPF_MX_RECORD.value)
    expect(prompt).toContain(DKIM_RECORD.value)
  })

  it("não menciona o provedor de e-mail na narrativa", () => {
    expect(prompt).not.toMatch(/Resend/)
  })

  it("nomeia o painel da hospedagem na persona quando ela é conhecida", () => {
    const withProvider = buildDnsInstructionsAgentPrompt({
      domainName: DOMAIN_NAME,
      records: ALL_RECORDS,
      providerName: "Locaweb",
    })
    expect(withProvider).toContain(
      `Você tem acesso ao painel da Locaweb, hospedagem de DNS do domínio ${DOMAIN_NAME}.`
    )
    expect(withProvider).not.toMatch(/Resend/)
  })

  it("abre com o aviso da Cloudflare antes das regras quando a hospedagem é a Cloudflare", () => {
    const cloudflare = buildDnsInstructionsAgentPrompt({
      domainName: DOMAIN_NAME,
      records: ALL_RECORDS,
      providerName: "Cloudflare",
    })
    const warningIndex = cloudflare.indexOf("o DNS deste domínio está na Cloudflare")
    expect(warningIndex).toBeGreaterThan(-1)
    expect(warningIndex).toBeLessThan(cloudflare.indexOf("Regras:"))
  })
})

describe("buildDnsInstructionsEmailContent", () => {
  const content = buildDnsInstructionsEmailContent({
    domainName: DOMAIN_NAME,
    records: ALL_RECORDS,
  })

  it("monta assunto com o domínio e corpo texto igual às instruções", () => {
    expect(content.subject).toBe(`[Corretor Studio] Registros DNS do domínio ${DOMAIN_NAME}`)
    expect(content.text).toContain(
      `Registros DNS para verificação do domínio ${DOMAIN_NAME} no Corretor Studio`
    )
  })

  it("escapa HTML nos valores dos registros", () => {
    const hostile = buildDnsInstructionsEmailContent({
      domainName: DOMAIN_NAME,
      records: [{ ...DKIM_RECORD, value: 'p=abc"<script>x()</script>' }],
    })
    expect(hostile.html).not.toContain("<script>")
    expect(hostile.html).toContain("&lt;script&gt;")
  })

  it("não menciona o provedor de e-mail na narrativa", () => {
    expect(content.subject).not.toMatch(/Resend/)
    expect(content.text).not.toMatch(/Resend/)
    expect(content.html).not.toMatch(/Resend/)
  })

  it("propaga a hospedagem conhecida para o corpo do e-mail", () => {
    const withProvider = buildDnsInstructionsEmailContent({
      domainName: DOMAIN_NAME,
      records: ALL_RECORDS,
      providerName: "GoDaddy",
    })
    expect(withProvider.text).toContain("no painel da GoDaddy")
    expect(withProvider.html).toContain("no painel da GoDaddy")
    expect(withProvider.html).not.toMatch(/Resend/)
  })
})
