/**
 * SPEC 10, A-E6 (DA6, W7) — mascara e-mail, telefone e CNPJ **na leitura**
 * da API de logs de webhook (entrada e saída). A escrita continua com o
 * dado completo (suporte precisa dele) — a máscara nunca roda antes de
 * gravar, só quando um endpoint devolve o payload para a tela.
 *
 * Duas estratégias combinadas:
 * 1. Por chave conhecida (email/phone/cnpj e variações em português) —
 *    cobre o contrato estruturado do webhook (`StudioWebhookLeadRequestSchema`)
 *    e qualquer `metadata` aninhado com esses nomes.
 * 2. Por padrão de e-mail em qualquer string (defesa em profundidade) —
 *    cobre texto livre (ex.: `errorMessage` citando um e-mail) que a
 *    checagem por chave não pega.
 */
const SENSITIVE_KEY_PATTERNS: Array<{ pattern: RegExp; kind: "email" | "phone" | "cnpj" }> = [
  { pattern: /email/i, kind: "email" },
  { pattern: /(phone|telefone|celular|whatsapp|tel)$/i, kind: "phone" },
  { pattern: /(cnpj|documento|document)$/i, kind: "cnpj" },
];

const EMAIL_IN_TEXT_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const maskEmailValue = (value: string): string => {
  const [local, domain] = value.split("@");
  if (!domain) return maskGenericString(value);

  const maskedLocal = local && local.length > 0 ? `${local[0]}${"*".repeat(Math.max(local.length - 1, 3))}` : "***";
  const domainParts = domain.split(".");
  const tld = domainParts.pop() ?? "";
  const maskedDomainHead = domainParts.join(".").slice(0, 1) || "*";
  return `${maskedLocal}@${maskedDomainHead}${"*".repeat(3)}.${tld}`;
};

const maskDigitsKeepingLast = (value: string, keep = 2): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= keep) {
    return "*".repeat(value.length);
  }

  let remaining = keep;
  let result = "";
  for (let i = value.length - 1; i >= 0; i -= 1) {
    const char = value[i] as string;
    if (/\d/.test(char) && remaining > 0) {
      result = char + result;
      remaining -= 1;
    } else if (/\d/.test(char)) {
      result = "*" + result;
    } else {
      result = char + result;
    }
  }
  return result;
};

const maskGenericString = (value: string): string => {
  if (value.length <= 2) return "*".repeat(value.length);
  return `${value[0]}${"*".repeat(value.length - 2)}${value[value.length - 1]}`;
};

const maskEmailsWithinText = (value: string): string => {
  return value.replace(EMAIL_IN_TEXT_PATTERN, (match) => maskEmailValue(match));
};

const matchSensitiveKey = (key: string): "email" | "phone" | "cnpj" | null => {
  for (const { pattern, kind } of SENSITIVE_KEY_PATTERNS) {
    if (pattern.test(key)) return kind;
  }
  return null;
};

const maskValueForKey = (key: string, value: unknown): unknown => {
  if (typeof value !== "string" || value.length === 0) {
    return value;
  }

  const kind = matchSensitiveKey(key);
  if (kind === "email") return maskEmailValue(value);
  if (kind === "phone") return maskDigitsKeepingLast(value, 2);
  if (kind === "cnpj") return maskDigitsKeepingLast(value, 2);

  return maskEmailsWithinText(value);
};

/**
 * Percorre um payload JSON qualquer (objeto, array, primitivo) e devolve
 * uma CÓPIA com os campos sensíveis mascarados. Nunca muta a entrada.
 */
export const maskSensitiveWebhookPayload = <T>(value: T): T => {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveWebhookPayload(item)) as unknown as T;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      if (nested !== null && typeof nested === "object") {
        return [key, maskSensitiveWebhookPayload(nested)] as const;
      }
      return [key, maskValueForKey(key, nested)] as const;
    });
    return Object.fromEntries(entries) as T;
  }

  if (typeof value === "string") {
    return maskEmailsWithinText(value) as unknown as T;
  }

  return value;
};
