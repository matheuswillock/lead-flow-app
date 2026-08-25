/**
 * Backfill de leads do GPS Insurance — investigação "padua.xlsx" (2026-08-24).
 *
 * Cria no CRM os leads recuperáveis da investigação registrada em
 * "Corretor studio/Specs/CDP 2026-08/02 — Investigação GPS Insurance (padua) — 2026-08-24"
 * (Obsidian): destinatários identificados das cascas de scanner + o visitante humano
 * de 24/08. Nome/telefone/CNPJ vêm das listas frias importadas do próprio time
 * (corretor_studio_email_contacts.customFields) — nada é inventado; candidato sem
 * nome de pessoa ou telefone fica no relatório de pendências (fixture).
 *
 * Uso (o preload neutraliza o guard `server-only` da cadeia do LeadUseCase):
 *   bun --preload ./scripts/lib/bun-next-runtime-shims.ts scripts/backfill-gps-padua-leads.ts            # dry-run (padrão, só leitura)
 *   bun --preload ./scripts/lib/bun-next-runtime-shims.ts scripts/backfill-gps-padua-leads.ts --apply    # cria os leads (exige autorização do dono)
 *   bun --preload ./scripts/lib/bun-next-runtime-shims.ts scripts/backfill-gps-padua-leads.ts --only=email  # filtra um candidato
 *
 * O card do lead mostra a origem via originChannel=email_campaign +
 * originMetadata.source = nome do formulário (mesmo caminho dos leads de campanha),
 * e a atividade de criação registra a evidência da recuperação.
 *
 * A fixture (scripts/fixtures/gps-padua-leads.json) contém dados pessoais e NÃO é
 * versionada — é gerada a partir das listas de contatos do próprio time (processo
 * documentado na nota do Obsidian citada acima) e mantida apenas localmente.
 */

import { LeadStatus } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { LeadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository"
import { LeadUseCase } from "@/app/api/useCases/leads/LeadUseCase"
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase"
import type { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead"
import fixture from "./fixtures/gps-padua-leads.json"

// Mesma composição usada pelo caminho de formulários públicos (publicFormLeadSync.ts:40).
const leadUseCase = new LeadUseCase(new LeadRepository(), new RegisterNewUserProfile())

const GPS_TEAM_ID = "3a5c6f44-669e-4cca-8cc9-c9ea395123f8"
const GPS_FORM_ID = "244afa18-0e95-4d88-a80d-c113359117bc"
const BACKFILL_TAG = "gps-padua-2026-08-24"

type Candidato = (typeof fixture.candidatos)[number]

type ResultadoLinha = {
  email: string
  situacao: "criaria" | "criado" | "ja_existe" | "duplicata_potencial" | "erro"
  detalhe: string
}

function parseFlags(argv: string[]): { apply: boolean; only?: string } {
  const apply = argv.includes("--apply")
  const only = argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length)
  return { apply, only }
}

async function leadJaExiste(email: string): Promise<boolean> {
  const existing = await prisma.lead.findFirst({
    where: { teamId: GPS_TEAM_ID, email: { equals: email, mode: "insensitive" }, deletedAt: null },
    select: { id: true },
  })
  return Boolean(existing)
}

function montarRequest(
  candidato: Candidato,
  form: { name: string; publicId: string },
): CreateLeadRequest {
  return {
    name: candidato.nome,
    email: candidato.email,
    phone: candidato.telefone,
    cnpj: candidato.cnpj,
    status: LeadStatus.new_opportunity,
    // Notas e atividade são superfícies visíveis ao cliente final: linguagem de
    // produto, nunca jargão de investigação/backfill. O contexto interno
    // (tag, evidência) vive só no originMetadata (JSON não exibido como texto).
    notes: [
      `Razão social: ${candidato.razaoSocial}`,
      `Origem: campanha de e-mail "Juridico SP Capital" — formulário "${form.name}".`,
    ].join("\n"),
    confirmDuplicate: false,
    originChannel: "email_campaign",
    originMetadata: {
      source: form.name,
      formId: GPS_FORM_ID,
      formPublicId: form.publicId,
      attribution: "email_campaign",
      campaignName: "Juridico SP Capital",
      backfill: BACKFILL_TAG,
      motivo: candidato.evidencia,
    },
    // Mesmo padrão de PromoteRadarProfileToLeadUseCase: o tipo inferido do Zod
    // exige as chaves opcionais-undefined; o subset preenchido é validado pelo
    // próprio schema dentro do createLead.
  } as unknown as CreateLeadRequest
}

async function main(): Promise<void> {
  const { apply, only } = parseFlags(process.argv.slice(2))
  const modo = apply ? "APPLY" : "DRY-RUN"
  console.info(`[BackfillGpsPaduaLeads] modo=${modo} tag=${BACKFILL_TAG}`)

  const team = await prisma.team.findUnique({
    where: { id: GPS_TEAM_ID },
    select: { name: true, master: { select: { supabaseId: true } } },
  })
  if (!team?.master?.supabaseId) {
    throw new Error("Time GPS Insurance ou master.supabaseId não encontrado — abortando")
  }

  const form = await prisma.publicForm.findUnique({
    where: { id: GPS_FORM_ID },
    select: { name: true, publicId: true },
  })
  if (!form) {
    throw new Error("Formulário Padrão do GPS não encontrado — abortando")
  }

  const candidatos = fixture.candidatos.filter(
    (candidato) => !only || candidato.email === only,
  )
  const resultados: ResultadoLinha[] = []

  for (const candidato of candidatos) {
    if (await leadJaExiste(candidato.email)) {
      resultados.push({ email: candidato.email, situacao: "ja_existe", detalhe: "lead ativo com este e-mail no time" })
      continue
    }

    const request = montarRequest(candidato, form)

    if (!apply) {
      resultados.push({
        email: candidato.email,
        situacao: "criaria",
        detalhe: `${candidato.nome} · ${candidato.telefone} · CNPJ ${candidato.cnpj}`,
      })
      continue
    }

    const output = await leadUseCase.createLead(
      team.master.supabaseId,
      request,
      GPS_TEAM_ID,
      {
        authorAsStudio: true,
        body: `Lead identificado a partir da campanha de e-mail "Juridico SP Capital" (formulário "${form.name}").`,
        payload: {
          kind: "lead_creation",
          channel: "email_campaign_backfill",
          formId: GPS_FORM_ID,
          backfill: BACKFILL_TAG,
          motivo: candidato.evidencia,
        },
      },
      { autoScheduleMeeting: false },
    )

    if (output.isValid) {
      const lead = output.result as { id?: string; leadCode?: string | null } | null
      resultados.push({ email: candidato.email, situacao: "criado", detalhe: `leadCode=${lead?.leadCode ?? lead?.id ?? "?"}` })
      continue
    }

    const requiresConfirmation = Boolean(
      output.result && typeof output.result === "object" && "requiresDuplicateConfirmation" in output.result,
    )
    resultados.push({
      email: candidato.email,
      situacao: requiresConfirmation ? "duplicata_potencial" : "erro",
      detalhe: output.errorMessages.join("; ") || "falha desconhecida",
    })
  }

  console.info("\n[BackfillGpsPaduaLeads] Resultado:")
  for (const linha of resultados) {
    console.info(`  ${linha.situacao.padEnd(20)} ${linha.email.padEnd(40)} ${linha.detalhe}`)
  }

  const porSituacao = resultados.reduce<Record<string, number>>((acc, linha) => {
    acc[linha.situacao] = (acc[linha.situacao] ?? 0) + 1
    return acc
  }, {})
  console.info(`\n[BackfillGpsPaduaLeads] Totais: ${JSON.stringify(porSituacao)} | pendentes de enriquecimento (não criados): ${fixture.pendentesEnriquecimento.length}`)
  for (const pendente of fixture.pendentesEnriquecimento) {
    console.info(`  pendente             ${pendente.email.padEnd(40)} ${pendente.motivo}`)
  }

  const houveErro = resultados.some((linha) => linha.situacao === "erro")
  if (houveErro) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error("[BackfillGpsPaduaLeads] Erro fatal:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
