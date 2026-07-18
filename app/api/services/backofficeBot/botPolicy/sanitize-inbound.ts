const MAX_INBOUND_MESSAGE_LENGTH = 2000;

/** Classic SQL injection / probe patterns (defense-in-depth; Prisma already parameterizes). */
const SQL_INJECTION_PATTERNS: RegExp[] = [
  /('\s*or\s+'?\d+'?\s*=\s*'?\d+)/i,
  /('\s*or\s+1\s*=\s*1)/i,
  /(;\s*drop\s+(table|database|schema))/i,
  /(;\s*delete\s+from)/i,
  /(;\s*truncate\s+)/i,
  /(union\s+select)/i,
  /(information_schema)/i,
  /(\/\*|\*\/)/,
  /(--\s)/,
  /(xp_cmdshell)/i,
  /(exec\s*\(\s*['"]?\s*sp_)/i,
  /(into\s+outfile)/i,
  /(load_file\s*\()/i,
  /(benchmark\s*\()/i,
  /(sleep\s*\(\s*\d+\s*\))/i,
  /(pg_sleep\s*\()/i,
  /(`?\s*(select|insert|update|delete|drop)\s+.*from\s+)/i,
];

export type SanitizeInboundResult =
  | { ok: true; text: string }
  | { ok: false; errorCode: "INBOUND_REJECTED_INJECTION" };

export function sanitizeInboundMessage(raw: string): SanitizeInboundResult {
  const text = raw.trim();
  if (text.length > MAX_INBOUND_MESSAGE_LENGTH) {
    return { ok: false, errorCode: "INBOUND_REJECTED_INJECTION" };
  }

  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return { ok: false, errorCode: "INBOUND_REJECTED_INJECTION" };
    }
  }

  return { ok: true, text };
}

export const INBOUND_REJECTED_USER_MESSAGE =
  "Não consegui processar essa mensagem. Envie um texto simples ou use o menu (MENU).";
