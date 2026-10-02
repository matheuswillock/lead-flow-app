import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import {
  buildLeadNotificationEmailTemplate,
  buildLeadProposalPendingUrgentEmailTemplate,
  buildLeadTransferActivatedEmailTemplate,
} from "./lead-notification-templates"

// Mesmo padrão de `meeting-schedule-templates.test.ts` (achado R13-review1-2):
// `getFullUrl` lê NEXT_PUBLIC_APP_URL em tempo de chamada, e `.env.test` do
// runner pode não trazer um valor https determinístico.
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test"
})

afterEach(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL
})

// A-E1b (SPEC 13): mesma classe de vulnerabilidade da V4 (DA8), em templates
// fora da agenda que o revisor do PR 1 encontrou fora de escopo e o owner
// decidiu incluir na SPEC ("todas as vulnerabilidades entram").

describe("buildLeadNotificationEmailTemplate", () => {
  const base = {
    leadName: "Lead Normal",
    leadEmail: "lead@normal.com",
    managerName: "Gestor Normal",
  }

  test("nome do lead é escapado", () => {
    const malicious = `<a href="https://evil.example">Confirme</a>`
    const { html } = buildLeadNotificationEmailTemplate({ ...base, leadName: malicious })

    expect(html).not.toContain(malicious)
    expect(html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;Confirme&lt;/a&gt;")
  })

  test("e-mail do lead é escapado", () => {
    const malicious = `<script>evilJs(1)</script>`
    const { html } = buildLeadNotificationEmailTemplate({ ...base, leadEmail: malicious })

    expect(html).not.toContain("<script>evilJs(1)</script>")
  })

  test("telefone do lead é escapado", () => {
    const malicious = `<b>11999999999</b>`
    const { html } = buildLeadNotificationEmailTemplate({ ...base, leadPhone: malicious })

    expect(html).not.toContain("<b>11999999999</b>")
    expect(html).toContain("&lt;b&gt;11999999999&lt;/b&gt;")
  })

  test("nome do gestor é escapado", () => {
    const malicious = `<img src=x onerror=evilJs(1)>`
    const { html } = buildLeadNotificationEmailTemplate({ ...base, managerName: malicious })

    expect(html).not.toContain(malicious)
    expect(html).toContain("&lt;img src=x onerror=evilJs(1)&gt;")
  })

  test("mantém o layout quando não há telefone", () => {
    const { html } = buildLeadNotificationEmailTemplate(base)
    expect(html).toContain("Novo Lead Recebido!")
    expect(html).not.toContain("Telefone")
  })
})

describe("buildLeadProposalPendingUrgentEmailTemplate", () => {
  const base = {
    leadCode: "LEAD-1",
    leadName: "Lead Normal",
    actorName: "Ator Normal",
  }

  test("nome do lead é escapado", () => {
    const malicious = `<a href="https://evil.example">Confirme</a>`
    const { html } = buildLeadProposalPendingUrgentEmailTemplate({ ...base, leadName: malicious })

    expect(html).not.toContain(malicious)
    expect(html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;Confirme&lt;/a&gt;")
  })

  test("ator, sdr, closer, e-mail, telefone e notas são escapados", () => {
    const malicious = `<script>evilJs(1)</script>`
    const { html } = buildLeadProposalPendingUrgentEmailTemplate({
      ...base,
      actorName: malicious,
      sdrName: malicious,
      closerName: malicious,
      leadEmail: malicious,
      leadPhone: malicious,
      notes: malicious,
    })

    expect(html).not.toContain("<script>evilJs(1)</script>")
  })

  test("título (h1) é escapado; assunto continua cru", () => {
    const malicious = `Lead <script>evilJs(1)</script>`
    const { html, subject } = buildLeadProposalPendingUrgentEmailTemplate({
      ...base,
      leadCode: malicious,
    })

    expect(html).not.toContain("<script>evilJs(1)</script>")
    expect(subject).toContain(malicious)
  })
})

describe("buildLeadTransferActivatedEmailTemplate", () => {
  const base = {
    leadCode: "LEAD-1",
    leadName: "Lead Normal",
  }

  test("nome, telefone, cnpj, plano, sdr e notas são escapados", () => {
    const malicious = `<script>evilJs(1)</script>`
    const { html } = buildLeadTransferActivatedEmailTemplate({
      ...base,
      leadName: malicious,
      leadPhone: malicious,
      leadCnpj: malicious,
      leadCurrentHealthPlan: malicious,
      sdrName: malicious,
      leadNotes: malicious,
    })

    expect(html).not.toContain("<script>evilJs(1)</script>")
  })

  test("scheduleShareUrl com javascript: é descartado (não vira href)", () => {
    const { html } = buildLeadTransferActivatedEmailTemplate({
      ...base,
      scheduleShareUrl: "javascript:evilJs(document.cookie)",
    })

    expect(html).not.toContain('href="javascript:')
  })

  test("scheduleShareUrl https válido continua clicável", () => {
    const { html } = buildLeadTransferActivatedEmailTemplate({
      ...base,
      scheduleShareUrl: "https://app.example.com/agendar/abc",
    })

    expect(html).toContain('href="https://app.example.com/agendar/abc"')
  })
})

describe("varredura comportamental — A-E1b (mesma técnica da T-13.3)", () => {
  const PROBE = `<v4-probe>&"'</v4-probe>`

  test("buildLeadNotificationEmailTemplate: leadName, leadEmail, leadPhone, managerName", () => {
    const base = { leadName: "N", leadEmail: "e@e.com", managerName: "M" }
    for (const field of ["leadName", "leadEmail", "leadPhone", "managerName"] as const) {
      const { html } = buildLeadNotificationEmailTemplate({ ...base, [field]: PROBE })
      expect(html).not.toContain(PROBE)
    }
  })

  test("buildLeadProposalPendingUrgentEmailTemplate: campos de texto", () => {
    const base = { leadCode: "LEAD-1", leadName: "N", actorName: "A" }
    for (const field of [
      "leadName",
      "leadEmail",
      "leadPhone",
      "sdrName",
      "closerName",
      "notes",
      "actorName",
    ] as const) {
      const { html } = buildLeadProposalPendingUrgentEmailTemplate({ ...base, [field]: PROBE })
      expect(html).not.toContain(PROBE)
    }
  })

  test("buildLeadTransferActivatedEmailTemplate: campos de texto", () => {
    const base = { leadCode: "LEAD-1", leadName: "N" }
    for (const field of [
      "leadName",
      "leadPhone",
      "leadCnpj",
      "leadCurrentHealthPlan",
      "sdrName",
      "leadNotes",
    ] as const) {
      const { html } = buildLeadTransferActivatedEmailTemplate({ ...base, [field]: PROBE })
      expect(html).not.toContain(PROBE)
    }
  })
})
