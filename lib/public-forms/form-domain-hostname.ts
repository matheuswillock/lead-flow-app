import { getDomain } from "tldts"

/**
 * Validação do hostname do domínio de formulários do time.
 *
 * Aceita apenas um SUBDOMÍNIO lowercase de domínio válido (ex.:
 * forms.imobiliariax.com.br) — sem esquema, porta, path ou credenciais.
 * O apex é rejeitado: apex não aceita CNAME, e o fluxo de instruções DNS
 * entrega exatamente um CNAME.
 *
 * A contagem de labels (`MIN_SUBDOMAIN_LABELS`) sozinha não basta: um apex
 * brasileiro como `imobiliariax.com.br` já tem 3 labels e passaria como se
 * fosse um subdomínio válido — o CNAME emitido apontaria
 * `imobiliariax` → `imobiliariax.imobiliariax.com.br`, que nunca resolve, e a
 * verificação fica eternamente pendente (achado P2 do codex no PR #1204). Por
 * isso o veredito final usa `tldts#getDomain`, que conhece a Public Suffix
 * List (inclui `.com.br`, `.net.br`, `.adv.br`, `.eng.br` etc.): quando o
 * domínio registrável devolvido é igual ao input inteiro, o input É o apex,
 * não importa quantos labels o sufixo público tenha.
 */

export type FormDomainHostnameValidation =
  | { ok: true; hostname: string }
  | { ok: false; error: string }

const HOSTNAME_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const MAX_HOSTNAME_LENGTH = 253
const MAX_LABEL_LENGTH = 63
const MIN_SUBDOMAIN_LABELS = 3

export function validateFormDomainHostname(rawInput: string): FormDomainHostnameValidation {
  const input = rawInput.trim().toLowerCase().replace(/\.$/, "")

  if (!input) {
    return { ok: false, error: "Informe o subdomínio dos formulários (ex.: forms.suaempresa.com.br)" }
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//.test(input) || input.includes("://")) {
    return { ok: false, error: "Informe apenas o subdomínio, sem https:// (ex.: forms.suaempresa.com.br)" }
  }

  if (input.includes("/") || input.includes("?") || input.includes("#")) {
    return { ok: false, error: "Informe apenas o subdomínio, sem caminho (ex.: forms.suaempresa.com.br)" }
  }

  if (input.includes(":")) {
    return { ok: false, error: "Informe apenas o subdomínio, sem porta (ex.: forms.suaempresa.com.br)" }
  }

  if (input.includes("@") || /\s/.test(input)) {
    return { ok: false, error: "Subdomínio inválido (ex. válido: forms.suaempresa.com.br)" }
  }

  if (input.length > MAX_HOSTNAME_LENGTH) {
    return { ok: false, error: "Subdomínio muito longo" }
  }

  const labels = input.split(".")
  if (labels.length < MIN_SUBDOMAIN_LABELS) {
    return {
      ok: false,
      error: "Use um subdomínio do seu domínio (ex.: forms.suaempresa.com.br), não o domínio raiz",
    }
  }

  for (const label of labels) {
    if (label.length === 0 || label.length > MAX_LABEL_LENGTH || !HOSTNAME_LABEL_PATTERN.test(label)) {
      return { ok: false, error: "Subdomínio inválido (ex. válido: forms.suaempresa.com.br)" }
    }
  }

  const tld = labels[labels.length - 1]
  if (!/^[a-z]{2,}$/.test(tld)) {
    return { ok: false, error: "Subdomínio inválido (ex. válido: forms.suaempresa.com.br)" }
  }

  // Rejeita o apex mesmo quando o sufixo público tem mais de um label
  // (`.com.br`, `.net.br`, `.adv.br`, `.eng.br`...) — ver nota no topo do
  // arquivo. `getDomain` devolve o próprio input quando ele já é o domínio
  // registrável, isto é, não sobra nenhum label de subdomínio real.
  const registrableDomain = getDomain(input)
  if (!registrableDomain || registrableDomain === input) {
    return {
      ok: false,
      error: "Use um subdomínio do seu domínio (ex.: forms.suaempresa.com.br), não o domínio raiz",
    }
  }

  return { ok: true, hostname: input }
}
