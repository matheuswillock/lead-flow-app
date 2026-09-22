/**
 * Instruções de cadastro DNS do domínio personalizado, geradas a partir dos
 * registros reais do domínio do time — nunca de texto fixo. Compartilhado
 * entre o card de domínio (copiar instruções/prompt) e o backend (e-mail para
 * o responsável técnico), para as duas superfícies nunca descreverem
 * registros diferentes.
 *
 * A narrativa voltada ao usuário não menciona o provedor de e-mail; nomes
 * técnicos de registro (ex.: `resend._domainkey`) são dados do DNS e
 * permanecem como são. A hospedagem de DNS (HostGator, Cloudflare…) é outra
 * coisa e É citada quando conhecida — é justamente o painel que o operador
 * precisa abrir.
 */

import { CLOUDFLARE_DNS_PROVIDER_NAME } from "./dns-provider-map"
import { escapeHtml } from "./escape-html"

export type CustomDomainDnsRecord = {
  /** Propósito reportado pelo provedor: DKIM, SPF, Tracking, Receiving… */
  record?: string
  type: string
  name: string
  value: string
  ttl?: string
  priority?: number | string | null
  status?: string
}

export type DnsRecordSectionKey = "dkim" | "spf" | "tracking" | "receiving" | "other"

export type DnsRecordSection = {
  key: DnsRecordSectionKey
  records: CustomDomainDnsRecord[]
}

const SECTION_MATCHERS: Array<{
  key: Exclude<DnsRecordSectionKey, "other">
  matches: (purpose: string) => boolean
}> = [
  { key: "dkim", matches: (purpose) => purpose === "DKIM" },
  { key: "spf", matches: (purpose) => purpose === "SPF" },
  { key: "tracking", matches: (purpose) => purpose === "Tracking" || purpose === "TrackingCAA" },
  { key: "receiving", matches: (purpose) => purpose === "Receiving" },
]

/**
 * Paridade com a tabela do card: os registros são apresentados por seção
 * (DKIM / Envio / Tracking / Recebimento), na mesma ordem, e os que não casam
 * com nenhum propósito conhecido vão para "other" no final.
 */
export function groupDnsRecordsBySection(
  records: CustomDomainDnsRecord[]
): DnsRecordSection[] {
  const sections: DnsRecordSection[] = SECTION_MATCHERS.map((section) => ({
    key: section.key,
    records: records.filter((record) => section.matches(record.record?.trim() ?? "")),
  }))
  const matched = new Set(sections.flatMap((section) => section.records))
  const leftovers = records.filter((record) => !matched.has(record))
  if (leftovers.length > 0) {
    sections.push({ key: "other", records: leftovers })
  }
  return sections.filter((section) => section.records.length > 0)
}

export function isDnsRecordVerified(record: CustomDomainDnsRecord): boolean {
  return record.status === "verified"
}

const INSTRUCTION_SECTION_TITLES: Record<DnsRecordSectionKey, string> = {
  dkim: "DKIM (verificação do domínio)",
  spf: "Envio (SPF)",
  tracking: "Tracking",
  receiving: "Recebimento",
  other: "Outros registros",
}

export type DnsInstructionsInput = {
  domainName: string
  records: CustomDomainDnsRecord[]
  /**
   * Hospedagem de DNS identificada pelos nameservers (`dns-provider-map.ts`).
   * Quando conhecida, as instruções apontam o painel pelo nome em vez de falar
   * em "gerenciador de DNS da hospedagem" — o operador do caso Inter Plaza
   * levou uma investigação inteira para descobrir que precisava abrir a
   * HostGator. Ausente/`null` mantém a narrativa genérica.
   */
  providerName?: string | null
}

function formatDnsRecordLine(record: CustomDomainDnsRecord): string {
  const parts = [`Tipo: ${record.type}`, `Nome: ${record.name}`, `Valor: ${record.value}`]
  if (record.priority !== undefined && record.priority !== null && `${record.priority}`.trim() !== "") {
    parts.push(`Prioridade: ${record.priority}`)
  }
  parts.push(`TTL: ${record.ttl?.trim() || "Auto"}`)
  return `  ${parts.join(" | ")}`
}

function formatDnsSectionsBlock(records: CustomDomainDnsRecord[]): string {
  return groupDnsRecordsBySection(records)
    .map((section) =>
      [INSTRUCTION_SECTION_TITLES[section.key], ...section.records.map(formatDnsRecordLine)].join(
        "\n"
      )
    )
    .join("\n\n")
}

/** Vale como precaução quando a hospedagem é desconhecida ou não é a Cloudflare. */
const CLOUDFLARE_PROXY_WARNING =
  'Atenção: se a hospedagem usa Cloudflare, os registros do e-mail NÃO podem ficar atrás do proxy (nuvem laranja) — deixe cada um como "DNS only" (nuvem cinza).'

/**
 * Com a Cloudflare confirmada pelos nameservers o aviso deixa de ser hipótese e
 * vira o primeiro passo da tarefa — por isso sobe do rodapé para o topo.
 */
const CONFIRMED_CLOUDFLARE_PROXY_WARNING =
  'Atenção: o DNS deste domínio está na Cloudflare — os registros do e-mail NÃO podem ficar atrás do proxy (nuvem laranja). Deixe cada um como "DNS only" (nuvem cinza).'

const AFTER_SETUP_NOTE =
  'Depois de cadastrar, volte ao Corretor Studio → Configurações de E-mail e clique em "Verificar DNS". A propagação pode levar de minutos a algumas horas.'

function isCloudflareProvider(providerName?: string | null): boolean {
  return providerName === CLOUDFLARE_DNS_PROVIDER_NAME
}

/** Sintagma sem artigo: quem chama compõe "no ..." ou "ao ..." conforme a frase. */
function dnsManagerPhrase(domainName: string, providerName?: string | null): string {
  return providerName
    ? `painel da ${providerName}, hospedagem de DNS do domínio ${domainName}`
    : `gerenciador de DNS da hospedagem do domínio ${domainName}`
}

/** Texto puro, pronto para colar num chat ou ticket com o suporte da hospedagem. */
export function buildDnsInstructionsText({
  domainName,
  records,
  providerName,
}: DnsInstructionsInput): string {
  const cloudflareConfirmed = isCloudflareProvider(providerName)

  return [
    `Registros DNS para verificação do domínio ${domainName} no Corretor Studio`,
    "",
    ...(cloudflareConfirmed ? [CONFIRMED_CLOUDFLARE_PROXY_WARNING, ""] : []),
    `Cadastre os registros abaixo no ${dnsManagerPhrase(domainName, providerName)}:`,
    "",
    formatDnsSectionsBlock(records),
    "",
    ...(cloudflareConfirmed ? [] : [CLOUDFLARE_PROXY_WARNING, ""]),
    AFTER_SETUP_NOTE,
  ].join("\n")
}

/** Mesmo conteúdo formatado como prompt para um agente de IA executar no DNS. */
export function buildDnsInstructionsAgentPrompt({
  domainName,
  records,
  providerName,
}: DnsInstructionsInput): string {
  const cloudflareConfirmed = isCloudflareProvider(providerName)

  return [
    `Você tem acesso ao ${dnsManagerPhrase(domainName, providerName)}.`,
    `Sua tarefa é cadastrar os registros DNS abaixo, necessários para verificar o domínio ${domainName} no Corretor Studio.`,
    "",
    ...(cloudflareConfirmed ? [CONFIRMED_CLOUDFLARE_PROXY_WARNING, ""] : []),
    "Regras:",
    "1. Cadastre cada registro exatamente como descrito: tipo, nome, valor, prioridade (quando houver) e TTL.",
    '2. Não use o proxy da Cloudflare (nuvem laranja) em nenhum destes registros — deixe todos como "DNS only" (nuvem cinza).',
    "3. Não remova nem altere registros existentes. Se houver conflito com um registro já cadastrado, pare e reporte antes de mudar qualquer coisa.",
    "4. Confirme os registros um a um, listando tipo, nome e valor de cada um depois de criado.",
    "",
    "Registros:",
    "",
    formatDnsSectionsBlock(records),
    "",
    "Ao final, confirme que todos os registros foram criados e liste o resultado.",
  ].join("\n")
}

export type DnsInstructionsEmailContent = {
  subject: string
  text: string
  html: string
}

/**
 * Corpo do e-mail para o responsável técnico pela hospedagem. O bloco de
 * instruções vai em `<pre>` para preservar o alinhamento das linhas de
 * registro em qualquer cliente de e-mail.
 */
export function buildDnsInstructionsEmailContent(
  input: DnsInstructionsInput
): DnsInstructionsEmailContent {
  const instructions = buildDnsInstructionsText(input)
  const safeDomain = escapeHtml(input.domainName)
  const html = [
    '<div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.6; max-width: 640px;">',
    "<p>Olá,</p>",
    `<p>Estas são as instruções para cadastrar os registros DNS do domínio <strong>${safeDomain}</strong>, necessários para liberar o envio de e-mails pelo Corretor Studio.</p>`,
    `<pre style="background: #f3f4f6; border-radius: 8px; padding: 16px; font-family: Consolas, Menlo, monospace; font-size: 13px; white-space: pre-wrap; word-break: break-word;">${escapeHtml(instructions)}</pre>`,
    "<p>Este e-mail foi enviado pelo Corretor Studio a pedido de um usuário da plataforma.</p>",
    "</div>",
  ].join("\n")

  return {
    subject: `[Corretor Studio] Registros DNS do domínio ${input.domainName}`,
    text: instructions,
    html,
  }
}
