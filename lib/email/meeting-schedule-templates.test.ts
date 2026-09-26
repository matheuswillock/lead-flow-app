import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import {
  buildCloserScheduleNotificationEmailTemplate,
  buildMeetingContactNotificationEmailTemplate,
  buildMeetingInviteEmailTemplate,
} from "./meeting-schedule-templates"

const MEETING_DATE = new Date("2026-10-01T14:00:00Z")

// `getFullUrl` (usado para o link do lead no CRM) lê NEXT_PUBLIC_APP_URL em
// tempo de chamada. `||=` não bastava: o `.env.test` do runner já define essa
// variável (com `http://`, não `https://`), então o teste do link do CRM
// virava dependente de ambiente — mesmo precedente de
// `EmailCampaignDispatchService.test.ts:951-963`. Fixamos um valor https
// determinístico e restauramos depois, para não vazar para outros arquivos.
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test"
})

afterEach(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL
})

describe("buildMeetingInviteEmailTemplate — T-13.1, T-13.2 (V4)", () => {
  test("nome com tag de âncora maliciosa sai como texto no convite", () => {
    const malicious = `<a href="https://evil.example">Confirme</a>`
    const { html } = buildMeetingInviteEmailTemplate({
      leadName: malicious,
      organizerName: "Ana Souza",
      meetingDate: MEETING_DATE,
      meetingLink: "https://meet.google.com/abc-defg-hij",
    })

    expect(html).not.toContain(malicious)
    expect(html).not.toContain('<a href="https://evil.example">')
    expect(html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;Confirme&lt;/a&gt;")
  })

  test("nome do organizador também é escapado", () => {
    const malicious = `<img src=x onerror=evilJs(1)>`
    const { html } = buildMeetingInviteEmailTemplate({
      leadName: "Lead Normal",
      organizerName: malicious,
      meetingDate: MEETING_DATE,
    })

    expect(html).not.toContain(malicious)
    expect(html).toContain("&lt;img src=x onerror=evilJs(1)&gt;")
  })

  test("título derivado do nome do lead também é escapado", () => {
    const malicious = `</h2><script>evilJs(1)</script>`
    const { html } = buildMeetingInviteEmailTemplate({
      leadName: malicious,
      organizerName: "Ana Souza",
      meetingDate: MEETING_DATE,
    })

    expect(html).not.toContain("<script>evilJs(1)</script>")
  })

  test("texto exibido do link de reunião também é escapado (não só o href)", () => {
    // Achado R13-review2-1 / review1-1 (rodada 2): a sonda por campo cobria
    // leadName/organizerName/meetingTitle mas não o TEXTO visível de
    // meetingLink — só o `href`. Um valor que não é URL https vira texto puro
    // (buildLinkMarkup -> safeText), e precisa estar escapado.
    const malicious = `<img src=x onerror=evilJs(1)>`
    const { html } = buildMeetingInviteEmailTemplate({
      leadName: "Lead Normal",
      organizerName: "Ana Souza",
      meetingDate: MEETING_DATE,
      meetingLink: malicious,
    })

    expect(html).not.toContain(malicious)
    expect(html).toContain("&lt;img src=x onerror=evilJs(1)&gt;")
  })

  test("href com javascript: é descartado, sem virar link clicável", () => {
    const { html } = buildMeetingInviteEmailTemplate({
      leadName: "Lead Normal",
      organizerName: "Ana Souza",
      meetingDate: MEETING_DATE,
      meetingLink: "javascript:evilJs(document.cookie)",
    })

    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain("href='javascript:")
  })

  test("link https válido continua clicável", () => {
    const { html } = buildMeetingInviteEmailTemplate({
      leadName: "Lead Normal",
      organizerName: "Ana Souza",
      meetingDate: MEETING_DATE,
      meetingLink: "https://meet.google.com/abc-defg-hij",
    })

    expect(html).toContain('href="https://meet.google.com/abc-defg-hij"')
  })

  test("caracteres acentuados e & continuam corretos (não quebram o layout)", () => {
    const { html } = buildMeetingInviteEmailTemplate({
      leadName: `Ana & "Zé" <teste>`,
      organizerName: "José",
      meetingDate: MEETING_DATE,
    })

    expect(html).toContain("José")
    expect(html).toContain("Ana &amp; &quot;Zé&quot; &lt;teste&gt;")
  })
})

describe("buildCloserScheduleNotificationEmailTemplate — T-13.1, T-13.2 (V4)", () => {
  const baseInput = {
    closerName: "Carlos Closer",
    leadName: "Lead Normal",
    meetingTitle: "Reunião",
    meetingDate: MEETING_DATE,
    isReschedule: false,
    attendees: [] as string[],
  }

  test("nome com tag de âncora maliciosa sai como texto no aviso ao closer", () => {
    const malicious = `<a href="https://evil.example">Confirme</a>`
    const { html } = buildCloserScheduleNotificationEmailTemplate({
      ...baseInput,
      leadName: malicious,
    })

    expect(html).not.toContain(malicious)
    expect(html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;Confirme&lt;/a&gt;")
  })

  test("nome do closer é escapado", () => {
    const malicious = `<script>evilJs(1)</script>`
    const { html } = buildCloserScheduleNotificationEmailTemplate({
      ...baseInput,
      closerName: malicious,
    })

    expect(html).not.toContain("<script>evilJs(1)</script>")
  })

  test("título da reunião é escapado no assunto e no corpo", () => {
    const malicious = `</h2><img src=x onerror=evilJs(1)>`
    const { subject, html } = buildCloserScheduleNotificationEmailTemplate({
      ...baseInput,
      meetingTitle: malicious,
    })

    expect(html).not.toContain("<img src=x onerror=evilJs(1)>")
    expect(subject).toContain(malicious) // assunto de e-mail não é contexto HTML
  })

  test("telefone do lead é escapado", () => {
    const malicious = `<b>11999999999</b>`
    const { html } = buildCloserScheduleNotificationEmailTemplate({
      ...baseInput,
      leadPhone: malicious,
    })

    expect(html).not.toContain("<b>11999999999</b>")
    expect(html).toContain("&lt;b&gt;11999999999&lt;/b&gt;")
  })

  test("notas são escapadas", () => {
    const malicious = `<script>document.location='https://evil.example'</script>`
    const { html } = buildCloserScheduleNotificationEmailTemplate({
      ...baseInput,
      notes: malicious,
    })

    expect(html).not.toContain("<script>document.location")
  })

  test("cada convidado da lista é escapado individualmente", () => {
    const malicious = `<img src=x onerror=evilJs(1)>`
    const { html } = buildCloserScheduleNotificationEmailTemplate({
      ...baseInput,
      attendees: ["convidado@normal.com", malicious],
    })

    expect(html).not.toContain("<img src=x onerror=evilJs(1)>")
    expect(html).toContain("&lt;img src=x onerror=evilJs(1)&gt;")
  })

  test("texto exibido do link de reunião também é escapado (reunião online)", () => {
    const malicious = `<img src=x onerror=evilJs(1)>`
    const { html } = buildCloserScheduleNotificationEmailTemplate({
      ...baseInput,
      meetingType: "online",
      meetingLink: malicious,
    })

    expect(html).not.toContain(malicious)
    expect(html).toContain("&lt;img src=x onerror=evilJs(1)&gt;")
  })

  test("href do link de reunião com javascript: é descartado", () => {
    const { html } = buildCloserScheduleNotificationEmailTemplate({
      ...baseInput,
      meetingLink: "javascript:evilJs(1)",
    })

    expect(html).not.toContain('href="javascript:')
  })

  test("link do CRM usa apenas https", () => {
    const { html } = buildCloserScheduleNotificationEmailTemplate({
      ...baseInput,
      leadCode: "LEAD-123",
    })

    expect(html).toContain("Abrir lead no CRM")
    expect(html).toMatch(/href="https:\/\/[^"]*leadCode=LEAD-123"/)
  })

  test("DA8 aplicada ao pé da letra: NEXT_PUBLIC_APP_URL não-https faz o link do CRM sumir (não é regressão)", () => {
    // Registrado a pedido da revisão: em dev/E2E/preview com app-url http, o
    // link "Abrir lead no CRM" deixa de ser renderizado (em vez de virar um
    // href http inseguro). Em produção a URL é https, então não há efeito.
    // "href só aceita https: (...) vale para todos os caminhos" (DA8).
    process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000"
    const { html } = buildCloserScheduleNotificationEmailTemplate({
      ...baseInput,
      leadCode: "LEAD-123",
    })

    expect(html).not.toContain("Abrir lead no CRM")
    expect(html).not.toContain("href=\"http://127.0.0.1:3000")
  })

  describe("meetingType — linha Link/Formato (DA6, chegou via merge de origin/develop)", () => {
    test("online (padrão quando meetingType ausente): mostra Link", () => {
      const { html } = buildCloserScheduleNotificationEmailTemplate({
        ...baseInput,
        meetingLink: "https://meet.google.com/abc-defg-hij",
      })

      expect(html).toContain("<strong>Link:</strong>")
      expect(html).toContain('href="https://meet.google.com/abc-defg-hij"')
    })

    test("call: mostra Formato / Ligação por telefone, sem link", () => {
      const { html } = buildCloserScheduleNotificationEmailTemplate({
        ...baseInput,
        meetingType: "call",
        meetingLink: "https://meet.google.com/abc-defg-hij",
      })

      expect(html).toContain("<strong>Formato:</strong> Ligação por telefone")
      expect(html).not.toContain("meet.google.com")
    })

    test("whatsapp: mostra Formato / Contato via WhatsApp, sem link", () => {
      const { html } = buildCloserScheduleNotificationEmailTemplate({
        ...baseInput,
        meetingType: "whatsapp",
      })

      expect(html).toContain("<strong>Formato:</strong> Contato via WhatsApp")
    })
  })
})

describe("buildMeetingContactNotificationEmailTemplate — T-13.1, T-13.2 (V4)", () => {
  // `sendMeetingContactNotificationEmail` chegou via merge de `origin/develop`
  // depois deste PR ter sido aberto (mesma classe de template de agenda da
  // DA8, achado R13-review2-2) — coberto aqui para o merge não reintroduzir a
  // V4.
  const baseInput = {
    leadName: "Lead Normal",
    meetingDate: MEETING_DATE,
    meetingType: "call" as const,
    closerName: "Carlos Closer",
  }

  test("nome do lead é escapado", () => {
    const malicious = `<a href="https://evil.example">Confirme</a>`
    const { html } = buildMeetingContactNotificationEmailTemplate({ ...baseInput, leadName: malicious })

    expect(html).not.toContain(malicious)
    expect(html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;Confirme&lt;/a&gt;")
  })

  test("nome do closer é escapado (título, corpo e campo Contato)", () => {
    const malicious = `<script>evilJs(1)</script>`
    const { html } = buildMeetingContactNotificationEmailTemplate({ ...baseInput, closerName: malicious })

    expect(html).not.toContain("<script>evilJs(1)</script>")
  })

  test("telefone do closer é escapado", () => {
    const malicious = `<b>11999999999</b>`
    const { html } = buildMeetingContactNotificationEmailTemplate({
      ...baseInput,
      closerPhone: malicious,
    })

    expect(html).not.toContain("<b>11999999999</b>")
    expect(html).toContain("&lt;b&gt;11999999999&lt;/b&gt;")
  })

  test("assunto/título distingue Ligação de WhatsApp", () => {
    const call = buildMeetingContactNotificationEmailTemplate({ ...baseInput, meetingType: "call" })
    const whatsapp = buildMeetingContactNotificationEmailTemplate({ ...baseInput, meetingType: "whatsapp" })

    expect(call.title).toContain("Ligação")
    expect(whatsapp.title).toContain("WhatsApp")
  })
})

describe("varredura comportamental dos templates de agenda — T-13.3", () => {
  // Sonda com todos os caracteres que `escapeHtml` precisa neutralizar
  // (`<`, `>`, `&`, `"`, `'`). Diferente de uma varredura de texto-fonte, isto
  // testa o COMPORTAMENTO real: se qualquer campo deixar de passar pelo
  // helper — hoje ou numa mudança futura — a sonda aparece crua no HTML e o
  // teste correspondente fica vermelho, apontando exatamente qual campo
  // regrediu.
  //
  // Achado R13-review1-1 (rodada 1): a varredura original (regex de fonte
  // sobre `${input.`) não detectava quando a interpolação no HTML já lia uma
  // variável `safe*` resolvida.
  // Achado R13-review1-1/review2-1 (rodada 2, dois revisores independentes):
  // a sonda por campo não cobria o TEXTO exibido de `meetingLink` — só o
  // `href`. Cobrimos os dois casos de `buildLinkMarkup` abaixo: (a) valor que
  // não é URL https (vira texto simples) e (b) URL https com a sonda na
  // query (vira link clicável, com o texto visível também escapado).
  //
  // O "controle negativo" real desta suite não é um teste automatizado — é a
  // mutação manual, reproduzida três vezes nesta revisão (por mim e por dois
  // revisores independentes): remover um `escapeHtml(...)` do arquivo real,
  // ver os testes de campo correspondentes ficarem vermelhos, restaurar e
  // conferir `diff`/`sha256` idêntico ao original. Um teste que monta a
  // própria sonda numa string fabricada (sem tocar o módulo) não prova nada
  // sobre este arquivo — foi removido daqui por essa razão (achados
  // R13-review1-1 e R13-review2-3).
  const PROBE = `<v4-probe>&"'</v4-probe>`
  const PROBE_HTTPS_URL = `https://example.test/?q=${PROBE}`

  describe("buildMeetingInviteEmailTemplate", () => {
    const base = {
      leadName: "Lead Normal",
      organizerName: "Organizador Normal",
      meetingDate: MEETING_DATE,
    }

    test("leadName", () => {
      const { html } = buildMeetingInviteEmailTemplate({ ...base, leadName: PROBE })
      expect(html).not.toContain(PROBE)
    })

    test("organizerName", () => {
      const { html } = buildMeetingInviteEmailTemplate({ ...base, organizerName: PROBE })
      expect(html).not.toContain(PROBE)
    })

    test("meetingTitle", () => {
      const { html } = buildMeetingInviteEmailTemplate({ ...base, meetingTitle: PROBE })
      expect(html).not.toContain(PROBE)
    })

    test("leadName usado no título derivado (sem meetingTitle)", () => {
      const { html } = buildMeetingInviteEmailTemplate({ ...base, leadName: PROBE, meetingTitle: undefined })
      expect(html).not.toContain(PROBE)
    })

    test("meetingLink que não é URL https (texto puro)", () => {
      const { html } = buildMeetingInviteEmailTemplate({ ...base, meetingLink: PROBE })
      expect(html).not.toContain(PROBE)
    })

    test("meetingLink https com a sonda na query (link clicável)", () => {
      const { html } = buildMeetingInviteEmailTemplate({ ...base, meetingLink: PROBE_HTTPS_URL })
      expect(html).not.toContain(PROBE)
    })
  })

  describe("buildCloserScheduleNotificationEmailTemplate", () => {
    const base = {
      closerName: "Closer Normal",
      leadName: "Lead Normal",
      meetingTitle: "Reunião",
      meetingDate: MEETING_DATE,
      isReschedule: false,
      attendees: [] as string[],
    }

    test("closerName", () => {
      const { html } = buildCloserScheduleNotificationEmailTemplate({ ...base, closerName: PROBE })
      expect(html).not.toContain(PROBE)
    })

    test("leadName", () => {
      const { html } = buildCloserScheduleNotificationEmailTemplate({ ...base, leadName: PROBE })
      expect(html).not.toContain(PROBE)
    })

    test("meetingTitle", () => {
      const { html } = buildCloserScheduleNotificationEmailTemplate({ ...base, meetingTitle: PROBE })
      expect(html).not.toContain(PROBE)
    })

    test("leadPhone", () => {
      const { html } = buildCloserScheduleNotificationEmailTemplate({ ...base, leadPhone: PROBE })
      expect(html).not.toContain(PROBE)
    })

    test("notes", () => {
      const { html } = buildCloserScheduleNotificationEmailTemplate({ ...base, notes: PROBE })
      expect(html).not.toContain(PROBE)
    })

    test("cada item de attendees", () => {
      const { html } = buildCloserScheduleNotificationEmailTemplate({
        ...base,
        attendees: ["normal@example.com", PROBE],
      })
      expect(html).not.toContain(PROBE)
    })

    test("meetingLink que não é URL https (texto puro, reunião online)", () => {
      const { html } = buildCloserScheduleNotificationEmailTemplate({
        ...base,
        meetingType: "online",
        meetingLink: PROBE,
      })
      expect(html).not.toContain(PROBE)
    })

    test("meetingLink https com a sonda na query (link clicável, reunião online)", () => {
      const { html } = buildCloserScheduleNotificationEmailTemplate({
        ...base,
        meetingType: "online",
        meetingLink: PROBE_HTTPS_URL,
      })
      expect(html).not.toContain(PROBE)
    })
  })

  describe("buildMeetingContactNotificationEmailTemplate", () => {
    const base = {
      leadName: "Lead Normal",
      meetingDate: MEETING_DATE,
      meetingType: "whatsapp" as const,
      closerName: "Closer Normal",
    }

    test("leadName", () => {
      const { html } = buildMeetingContactNotificationEmailTemplate({ ...base, leadName: PROBE })
      expect(html).not.toContain(PROBE)
    })

    test("closerName", () => {
      const { html } = buildMeetingContactNotificationEmailTemplate({ ...base, closerName: PROBE })
      expect(html).not.toContain(PROBE)
    })

    test("closerPhone", () => {
      const { html } = buildMeetingContactNotificationEmailTemplate({ ...base, closerPhone: PROBE })
      expect(html).not.toContain(PROBE)
    })
  })
})
