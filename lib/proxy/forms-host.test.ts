import { describe, expect, it } from "bun:test"
import {
  classifyFormsHost,
  getPlatformBaseUrl,
  getPlatformHostnames,
  isPathAllowedOnFormsHost,
  normalizeHostname,
  type FormsHostEnv,
} from "./forms-host"

const ENV: FormsHostEnv = {
  appUrl: "https://www.corretorstudio.com",
  vercelUrl: "lead-flow-app-abc123.vercel.app",
  fallbackHost: "forms.neutro-exemplo.com.br",
}

const FORM_ID = "22222222-2222-4222-8222-222222222222"

describe("normalizeHostname", () => {
  it("aplica lowercase e remove porta", () => {
    expect(normalizeHostname("Forms.Imobiliariax.COM.br:443")).toBe("forms.imobiliariax.com.br")
  })

  it("remove ponto final e preserva IPv6 entre colchetes", () => {
    expect(normalizeHostname("forms.exemplo.com.br.")).toBe("forms.exemplo.com.br")
    expect(normalizeHostname("[::1]:3000")).toBe("::1")
  })

  it("retorna null para vazio", () => {
    expect(normalizeHostname("")).toBeNull()
    expect(normalizeHostname(null)).toBeNull()
    expect(normalizeHostname("   ")).toBeNull()
  })
})

describe("classifyFormsHost", () => {
  it("classifica o host da plataforma (com e sem www) como platform", () => {
    expect(classifyFormsHost("www.corretorstudio.com", ENV)).toBe("platform")
    expect(classifyFormsHost("corretorstudio.com", ENV)).toBe("platform")
    expect(classifyFormsHost("WWW.CORRETORSTUDIO.COM:443", ENV)).toBe("platform")
  })

  it("classifica localhost e deploys .vercel.app como platform", () => {
    expect(classifyFormsHost("localhost:3000", ENV)).toBe("platform")
    expect(classifyFormsHost("127.0.0.1:3001", ENV)).toBe("platform")
    expect(classifyFormsHost("lead-flow-app-abc123.vercel.app", ENV)).toBe("platform")
    expect(classifyFormsHost("preview-branch-xyz.vercel.app", ENV)).toBe("platform")
  })

  it("classifica host ausente como platform (fail-open)", () => {
    expect(classifyFormsHost(null, ENV)).toBe("platform")
    expect(classifyFormsHost("", ENV)).toBe("platform")
  })

  it("classifica o host neutro da env como fallback", () => {
    expect(classifyFormsHost("forms.neutro-exemplo.com.br", ENV)).toBe("fallback")
    expect(classifyFormsHost("FORMS.NEUTRO-EXEMPLO.COM.BR:443", ENV)).toBe("fallback")
  })

  it("sem a env de fallback, host neutro vira custom", () => {
    expect(classifyFormsHost("forms.neutro-exemplo.com.br", { ...ENV, fallbackHost: undefined })).toBe(
      "custom",
    )
  })

  it("classifica domínio de time como custom", () => {
    expect(classifyFormsHost("forms.imobiliariax.com.br", ENV)).toBe("custom")
    expect(classifyFormsHost("forms.outra-imobiliaria.com", ENV)).toBe("custom")
  })
})

describe("getPlatformHostnames", () => {
  it("deriva hostnames de todas as envs conhecidas + localhost", () => {
    const hosts = getPlatformHostnames(ENV)
    expect(hosts.has("www.corretorstudio.com")).toBe(true)
    expect(hosts.has("corretorstudio.com")).toBe(true)
    expect(hosts.has("lead-flow-app-abc123.vercel.app")).toBe(true)
    expect(hosts.has("localhost")).toBe(true)
    expect(hosts.has("127.0.0.1")).toBe(true)
  })
})

describe("isPathAllowedOnFormsHost", () => {
  it("permite páginas /forms/* e assets do Next", () => {
    expect(isPathAllowedOnFormsHost(`/forms/${FORM_ID}`)).toBe(true)
    expect(isPathAllowedOnFormsHost(`/forms/${FORM_ID}?cs_el=abc`)).toBe(true)
    expect(isPathAllowedOnFormsHost("/_next/static/chunks/main.js")).toBe(true)
    expect(isPathAllowedOnFormsHost("/favicon.ico")).toBe(true)
  })

  it("permite as APIs públicas do formulário (mascarada e real)", () => {
    for (const prefix of ["/api/q", "/api/v1"]) {
      expect(isPathAllowedOnFormsHost(`${prefix}/public-forms/${FORM_ID}`)).toBe(true)
      expect(isPathAllowedOnFormsHost(`${prefix}/public-forms/${FORM_ID}/prefill`)).toBe(true)
      expect(isPathAllowedOnFormsHost(`${prefix}/public-forms/${FORM_ID}/events`)).toBe(true)
      expect(isPathAllowedOnFormsHost(`${prefix}/public-forms/${FORM_ID}/progress`)).toBe(true)
      expect(isPathAllowedOnFormsHost(`${prefix}/public-forms/${FORM_ID}/submissions`)).toBe(true)
      expect(isPathAllowedOnFormsHost(`${prefix}/public-forms/${FORM_ID}/availability`)).toBe(true)
    }
  })

  it("bloqueia rotas da aplicação e APIs fora do formulário", () => {
    expect(isPathAllowedOnFormsHost("/")).toBe(false)
    expect(isPathAllowedOnFormsHost("/sign-in")).toBe(false)
    expect(isPathAllowedOnFormsHost("/backoffice")).toBe(false)
    expect(isPathAllowedOnFormsHost(`/${FORM_ID}/crm`)).toBe(false)
    expect(isPathAllowedOnFormsHost("/api/q/leads")).toBe(false)
    expect(isPathAllowedOnFormsHost("/api/v1/email/settings")).toBe(false)
    expect(isPathAllowedOnFormsHost("/api/webhooks/asaas")).toBe(false)
    expect(isPathAllowedOnFormsHost(`/api/q/public-forms/${FORM_ID}/qualquer-coisa`)).toBe(false)
    expect(isPathAllowedOnFormsHost("/api/q/public-forms/nao-uuid/events")).toBe(false)
  })
})

describe("getPlatformBaseUrl", () => {
  it("usa NEXT_PUBLIC_APP_URL quando presente", () => {
    expect(getPlatformBaseUrl(ENV)).toBe("https://www.corretorstudio.com")
    expect(getPlatformBaseUrl({ appUrl: "https://app.exemplo.com/" })).toBe("https://app.exemplo.com")
  })

  it("cai para VERCEL_URL e retorna null sem envs", () => {
    expect(getPlatformBaseUrl({ vercelUrl: "meu-app.vercel.app" })).toBe("https://meu-app.vercel.app")
    expect(getPlatformBaseUrl({})).toBeNull()
  })
})
