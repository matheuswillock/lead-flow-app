const SENSITIVE_PATTERNS: RegExp[] = [
  /\b\d{3}[.]?\d{3}[.]?\d{3}-?\d{2}\b/g, // CPF
  /\b\d{2}[.]?\d{3}[.]?\d{3}[\/]?\d{4}-?\d{2}\b/g, // CNPJ
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\+?\d[\d\s().-]{7,}\d/g,
];

/** Telemetry must contain classifications, never original user or lead content. */
export function redactBethaniaAiTelemetry(value: string): string {
  return SENSITIVE_PATTERNS.reduce((result, pattern) => result.replace(pattern, "[REDACTED]"), value);
}

export function toSafeBethaniaAiErrorCode(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "timeout";
  if (error instanceof Error && /rate.?limit|429/i.test(error.message)) return "rate_limited";
  return "provider_error";
}
