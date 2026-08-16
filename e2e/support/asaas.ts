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
  const apiUrl = [
    readEnv("ASAAS_URL"),
    readEnv("ASAAS_URL_sandbox"),
    readEnv("ASAAS_BASE_URL"),
  ]
    .find((value) => value.length > 0)
    ?.toLowerCase();
  const apiKey = readEnv("ASAAS_API_KEY");
  const sandboxKey = readEnv("ASAAS_SANDBOX_API_KEY");

  if (env === "production") {
    throw new Error(
      "E2E Asaas abortou: ASAAS_ENV=production. Specs MUST usar sandbox (sandbox.asaas.com).",
    );
  }

  if (apiUrl && PRODUCTION_HOST_MARKERS.some((marker) => apiUrl.includes(marker))) {
    throw new Error(
      `E2E Asaas abortou: URL de produção detectada (${apiUrl}). Use sandbox.asaas.com.`,
    );
  }

  if (apiUrl && !apiUrl.includes("sandbox.asaas.com") && env !== "sandbox") {
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
