/**
 * Guarda de homologação Asaas para specs E2E.
 *
 * Toda spec que cria customer, cobrança, checkout ou assinatura MUST
 * chamar `assertAsaasSandbox()` no `beforeAll` antes de qualquer request.
 * Falha imediata se o ambiente apontar para produção.
 */

const PRODUCTION_HOST_MARKERS = ["www.asaas.com", "api.asaas.com"];

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function assertAsaasSandbox(): void {
  const env = readEnv("ASAAS_ENV").toLowerCase();

  // Resolve a URL efetiva igual a lib/asaas.ts: com ASAAS_ENV=sandbox a app usa
  // ASAAS_URL_sandbox (ou fallback sandbox); com production usa ASAAS_URL.
  const isProduction = env === "production";
  const effectiveUrl = (isProduction
    ? readEnv("ASAAS_URL")
    : readEnv("ASAAS_URL_sandbox") || readEnv("ASAAS_URL") || readEnv("ASAAS_BASE_URL")
  ).toLowerCase();
  const apiKey = readEnv("ASAAS_API_KEY");
  const sandboxKey = readEnv("ASAAS_SANDBOX_API_KEY");

  if (isProduction) {
    throw new Error(
      "E2E Asaas abortou: ASAAS_ENV=production. Specs MUST usar sandbox (sandbox.asaas.com).",
    );
  }

  if (effectiveUrl && PRODUCTION_HOST_MARKERS.some((marker) => effectiveUrl.includes(marker))) {
    throw new Error(
      `E2E Asaas abortou: URL de produção detectada (${effectiveUrl}). Use sandbox.asaas.com.`,
    );
  }

  if (effectiveUrl && !effectiveUrl.includes("sandbox.asaas.com") && env !== "sandbox") {
    throw new Error(
      "E2E Asaas abortou: ASAAS_ENV precisa ser sandbox e a URL precisa ser sandbox.asaas.com.",
    );
  }

  const keyInUse = sandboxKey || apiKey;
  if (!keyInUse) {
    throw new Error(
      "E2E Asaas abortou: defina ASAAS_SANDBOX_API_KEY (nunca a chave de produção).",
    );
  }

  if (sandboxKey && apiKey && sandboxKey === apiKey && env !== "sandbox") {
    throw new Error(
      "E2E Asaas abortou: ASAAS_API_KEY coincide com a chave em uso sem ASAAS_ENV=sandbox.",
    );
  }
}
