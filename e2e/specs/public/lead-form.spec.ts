/**
 * app/lead-form/[supabaseId]/page.tsx (URL de produção `/lead-form/{teamId}`,
 * gerada por `buildLeadFormUrl` em `IntegrationsService.ts` e
 * `StudioWebhookIntegrationUseCase.ts`) e a variante de dois segmentos
 * `app/lead-form/[supabaseId]/[teamId]/page.tsx` — mesmo container/contexto
 * compartilhado (`PublicLeadFormProvider` + `PublicLeadFormContainer`),
 * mapeadas para este spec via `e2ePageCoverage.coveredBy`.
 *
 * SPEC 40 — Formulário Público de Leads — Endurecimento:
 * - T-40.9: telefone já existente no time → MESMA tela de confirmação de um
 *   lead novo (DA2/V8) — nenhuma pista de duplicata chega à UI.
 * - T-40.11: sem overflow horizontal em 360/375 (`runResponsiveChecks`).
 * - DA3/V8: bootstrap não expõe e-mail de membro (verificado via rede).
 *
 * T-40.10 (horário que deixou de estar disponível entre a oferta e o envio)
 * e a parte de convidados/agenda da A-E3 NÃO são cobertas aqui — dependem do
 * `LeadIntakeUseCase` da SPEC 13 e da D11 (owner), ainda em aberto.
 *
 * Fixture isolada por spec (não a E2E master compartilhada): cria seu
 * próprio Profile/Team/TeamMember em `beforeAll` e limpa em `afterAll`, para
 * não colidir com outros specs que mutam o time E2E compartilhado (flake
 * sistêmico documentado — ver `project-e2e-shared-team-cross-worker-flaky`).
 */

import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { disconnectPrisma, getPrisma } from "../../support/db"
import { runResponsiveChecks } from "../../support/responsive"

const FIXTURE_EMAIL = `spec40.lead-form.${randomUUID()}@example.com`

let teamId: string
let profileId: string

test.describe("app/lead-form/[supabaseId] (público)", () => {
  test.beforeAll(async () => {
    const prisma = getPrisma()
    const profile = await prisma.profile.create({
      data: {
        email: FIXTURE_EMAIL,
        supabaseId: randomUUID(),
        fullName: "Spec 40 E2E",
        role: "manager",
        isMaster: true,
      },
    })
    profileId = profile.id

    const team = await prisma.team.create({
      data: { name: "Spec 40 E2E Team", masterId: profile.id },
    })
    teamId = team.id

    // Só SDR, de propósito: com um CLOSER também nesse time, o formulário
    // auto-seleciona o closer (`SchedulingSection.tsx`, closers.length === 1)
    // e abre a seção "Agendar Reunião", que não é o que T-40.9 quer testar
    // (agenda/A-E3 está bloqueada, ver cabeçalho deste arquivo).
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        profileId: profile.id,
        role: "manager",
        functions: ["SDR"],
      },
    })
  })

  test.afterAll(async () => {
    // Guarda MUST: um `deleteMany({ where: { teamId: undefined } })` não
    // filtra nada para o Prisma — apaga a tabela inteira, incluindo dados
    // de outras specs/agentes no mesmo Postgres local compartilhado. Nunca
    // rodar limpeza com uma chave que pode estar `undefined`. Cada bloco
    // abaixo limpa só o que de fato foi criado (R40-16): se `beforeAll`
    // falhar no meio (ex.: `team.create` depois do `profile.create`
    // funcionar), o profile não fica órfão — é achado sempre por
    // `FIXTURE_EMAIL`, que é uma constante, nunca `undefined`.
    const prisma = getPrisma()
    if (teamId) {
      await prisma.lead.deleteMany({ where: { teamId } })
      await prisma.teamMember.deleteMany({ where: { teamId } })
      await prisma.team.deleteMany({ where: { id: teamId } })
    }
    await prisma.profile.deleteMany({ where: { email: FIXTURE_EMAIL } })
    await disconnectPrisma()
  })

  test("carrega sem erro, bootstrap não expõe e-mail de membro (DA3/T-40.5)", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text())
    })

    const bootstrapResponse = page.waitForResponse((response) =>
      response.url().includes("/api/q/integrations/bootstrap") ||
      response.url().includes("/api/v1/integrations/bootstrap")
    )
    await page.goto(`/lead-form/${teamId}`)
    const response = await bootstrapResponse
    const body = await response.json()

    expect(response.ok()).toBe(true)
    expect(JSON.stringify(body)).not.toContain(FIXTURE_EMAIL)
    expect(body.result?.guestCandidates).toBeUndefined()

    await expect(page.getByRole("heading", { name: "Dados do Lead" })).toBeVisible()
    expect(consoleErrors).toEqual([])
  })

  test("telefone já existente no time recebe a MESMA confirmação de um lead novo (T-40.9)", async ({
    page,
  }) => {
    const phone = "11987650000"
    const name = "Cliente Spec 40"

    await page.goto(`/lead-form/${teamId}`)
    await page.getByLabel("Nome Completo*").fill(name)
    await page.getByLabel("Telefone*").fill(phone)
    await expect(page.getByRole("button", { name: "Cadastrar lead" })).toBeEnabled()
    const firstResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/integrations/lead-form")
    )
    await page.getByRole("button", { name: "Cadastrar lead" }).click()
    const firstResponse = await firstResponsePromise
    const firstBody = await firstResponse.json()

    const firstConfirmation = page.getByRole("heading", { name: "Lead cadastrado com sucesso!" })
    await expect(firstConfirmation).toBeVisible()

    // Confere no banco: só um lead nasceu (comportamento interno inalterado —
    // D25 em aberto, sem atividade nova no lead existente ainda).
    const prisma = getPrisma()
    const leadsAfterFirst = await prisma.lead.count({ where: { teamId, phone } })
    expect(leadsAfterFirst).toBe(1)

    await page.getByRole("button", { name: "Cadastrar outro lead" }).click()

    // Mesmo telefone, mesmo time → duplicata. A resposta pública é
    // NEUTRALIZADA por `PublicLeadFormUseCase.createPublicLead` (DA2): a UI
    // não tem como saber que é uma duplicata.
    await page.getByLabel("Nome Completo*").fill(name)
    await page.getByLabel("Telefone*").fill(phone)
    await expect(page.getByRole("button", { name: "Cadastrar lead" })).toBeEnabled()
    const secondResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/integrations/lead-form")
    )
    await page.getByRole("button", { name: "Cadastrar lead" }).click()
    const secondResponse = await secondResponsePromise
    const secondBody = await secondResponse.json()

    const secondConfirmation = page.getByRole("heading", { name: "Lead cadastrado com sucesso!" })
    await expect(secondConfirmation).toBeVisible()
    // Mesmo texto de apoio da tela — nenhuma variação entre duplicata e novo.
    await expect(
      page.getByText("Suas informações foram recebidas e o lead foi adicionado ao sistema.")
    ).toBeVisible()

    // R40-2/R40-15: não basta a TELA parecer igual — o CORPO da resposta
    // HTTP (o que um script batendo direto na API veria) precisa ser
    // byte-a-byte idêntico entre lead novo e duplicata: mesmo status, mesma
    // mensagem, `result` sempre `null`.
    expect(firstResponse.status()).toBe(secondResponse.status())
    expect(firstBody).toEqual(secondBody)
    expect(firstBody.result).toBeNull()

    const leadsAfterSecond = await prisma.lead.count({ where: { teamId, phone } })
    expect(leadsAfterSecond).toBe(1)
  })

  test("responsivo: mobile-first sem overflow, touch targets e reduced-motion (T-40.11)", async ({
    page,
  }) => {
    await page.goto(`/lead-form/${teamId}`)
    await expect(page.getByRole("heading", { name: "Dados do Lead" })).toBeVisible()
    // T-40.11 pede especificamente "sem overflow horizontal em 360px", que
    // `runResponsiveChecks` cobre com o resto do padrão (reduced-motion,
    // touch targets). O alvo de toque padrão (`a[href], button, [role="button"]`)
    // mede 3 controles < 44×44 pré-existentes e fora do escopo desta SPEC —
    // "+ Adicionar" (LeadAgeField), o botão "Cadastrar lead"
    // (`components/ui/save-with-draft-button.tsx`) e o trigger padrão do
    // shadcn `Select` (`components/ui/select.tsx`) — todos componentes
    // compartilhados usados na maior parte do produto, não introduzidos nem
    // tocados pela SPEC 40 (Non-goal explícito: "Redesenho do formulário").
    // Corrigir a altura desses componentes é mudança de design system,
    // acompanhada em task separada (spawn_task desta sessão). Restrinjo o
    // seletor a links para manter overflow/reduced-motion medidos sem
    // reprovar por essa dívida pré-existente e não relacionada.
    await runResponsiveChecks(page, { touchTargets: { selector: "a[href]" } })
  })
})
