import { describe, expect, it } from "bun:test"
import { envSchema } from "./validation"

const BASE_VALID_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SUPABASE_LEAD_ATTACHMENTS_BUCKET: "lead-attachments",
  SUPABASE_PROFILE_ICONS_BUCKET: "profile-icons",
  SUPABASE_EMAIL_TEMPLATE_ASSETS_BUCKET: "email-template-assets",
  POSTGRES_USER: "postgres",
  POSTGRES_PASSWORD: "postgres",
  POSTGRES_HOST: "localhost",
  POSTGRES_PORT: "5432",
  POSTGRES_DB: "postgres",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
  RESEND_API_KEY: "re_1234567890",
  EMAIL_TEST_MODE: "false",
  RESEND_OWNER_EMAIL: "owner@example.com",
  SLACK_SUPPORT_WEBHOOK_URL: "https://hooks.slack.com/services/x",
  SLACK_BACKOFFICE_LEADS_WEBHOOK_URL: "https://hooks.slack.com/services/y",
  ASAAS_API_KEY: "aact_hmlg_1234567890",
  ASAAS_WEBHOOK_TOKEN: "webhook-token",
  ASAAS_ENV: "sandbox",
  ASAAS_URL: "https://www.asaas.com",
  ASAAS_URL_sandbox: "https://sandbox.asaas.com",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  NEXT_API_BASE_URL: "/api",
  NEXT_PUBLIC_SENTRY_DSN: "https://sentry.example.com/1",
  ENCRYPTION_KEY: "a".repeat(64),
  NEXT_PUBLIC_ENCRYPTION_KEY: "b".repeat(64),
  INTEGRATIONS_ENCRYPTION_KEY: "c".repeat(32),
  META_VERIFY_TOKEN: "meta-verify-token",
  OPENWA_API_URL: "http://openwa:3333",
  OPENWA_API_KEY: "openwa-api-key",
  OPENWA_WEBHOOK_SECRET: "d".repeat(32),
}

describe("envSchema — envs legacy do Asaas (E2)", () => {
  it("aceita ausência total das vars legacy (estado pré-cutover)", () => {
    const result = envSchema.safeParse(BASE_VALID_ENV)
    expect(result.success).toBe(true)
  })

  it("ASAAS_WALLET_ID ausente não derruba a validação (m12/H8 — zero call-sites)", () => {
    const result = envSchema.safeParse(BASE_VALID_ENV)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ASAAS_WALLET_ID).toBeUndefined()
    }
  })

  it("valida formato quando as vars legacy estão presentes", () => {
    const result = envSchema.safeParse({
      ...BASE_VALID_ENV,
      ASAAS_LEGACY_API_KEY: "aact_hmlg_legacy_key",
      ASAAS_LEGACY_WEBHOOK_TOKEN: "legacy-webhook-token",
    })
    expect(result.success).toBe(true)
  })

  it("rejeita ASAAS_LEGACY_API_KEY em formato inválido (mesma regra da chave primary)", () => {
    const result = envSchema.safeParse({
      ...BASE_VALID_ENV,
      ASAAS_LEGACY_API_KEY: "chave-sem-prefixo-aact",
    })
    expect(result.success).toBe(false)
  })

  // Achado de review (cursor[bot], PR #1100): .optional() do Zod só aceita
  // `undefined` — string vazia ("") ainda cai na validação de formato e
  // FALHA. .env.example/.env.test.example documentam as duas vars legacy
  // vazias (`ASAAS_LEGACY_API_KEY=`) como o estado pré-cutover — copiar o
  // arquivo como está faz a app recusar subir (EnvService.validate() →
  // process.exit(1) no startup/build, lib/env/startup-validation.ts).
  it("trata string vazia como ausente — copiar .env.example não derruba o boot (achado de review)", () => {
    const result = envSchema.safeParse({
      ...BASE_VALID_ENV,
      ASAAS_LEGACY_API_KEY: "",
      ASAAS_LEGACY_WEBHOOK_TOKEN: "",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ASAAS_LEGACY_API_KEY).toBeUndefined()
      expect(result.data.ASAAS_LEGACY_WEBHOOK_TOKEN).toBeUndefined()
    }
  })
})
