type SqlInjectionRule = {
  name: string;
  pattern: RegExp;
};

const SQL_INJECTION_RULES: SqlInjectionRule[] = [
  {
    name: "union_select",
    pattern: /\bunion\b(?:\s+all)?\s+select\b/i,
  },
  {
    name: "boolean_tautology",
    pattern: /\b(?:or|and)\b\s+\d+\s*=\s*\d+/i,
  },
  {
    name: "stacked_query",
    pattern: /;\s*(?:drop|delete|insert|update|alter|create|truncate)\b/i,
  },
  {
    name: "time_based_function",
    pattern: /\b(?:pg_sleep|sleep|benchmark|waitfor\s+delay)\b\s*\(?/i,
  },
  {
    name: "information_schema_access",
    pattern: /\binformation_schema\b/i,
  },
  {
    name: "xp_cmdshell_access",
    pattern: /\bxp_cmdshell\b/i,
  },
];

const decodeSafely = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeForInspection = (value: string): string =>
  decodeSafely(value).replace(/\s+/g, " ").trim();

export type SqlInjectionDetectionResult = {
  suspicious: boolean;
  rule?: string;
};

export const detectSqlInjection = (value: string): SqlInjectionDetectionResult => {
  if (!value || value.trim() === "") {
    return { suspicious: false };
  }

  const normalized = normalizeForInspection(value);

  for (const rule of SQL_INJECTION_RULES) {
    if (rule.pattern.test(normalized)) {
      return {
        suspicious: true,
        rule: rule.name,
      };
    }
  }

  return { suspicious: false };
};

