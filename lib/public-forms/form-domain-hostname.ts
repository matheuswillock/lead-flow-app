/**
 * Validação do hostname do domínio de formulários do time.
 *
 * Aceita apenas um SUBDOMÍNIO lowercase de domínio válido (ex.:
 * forms.imobiliariax.com.br) — sem esquema, porta, path ou credenciais.
 * O apex (imobiliariax.com) é rejeitado: apex não aceita CNAME, e o fluxo de
 * instruções DNS entrega exatamente um CNAME.
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

  return { ok: true, hostname: input }
}
