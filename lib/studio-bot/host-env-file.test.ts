import { describe, expect, it } from "bun:test"
import {
  buildOpsHostEnvFileContent,
  parseOpsHostEnvFileContent,
} from "./host-env"

describe("ops host env file", () => {
  it("builds and parses round-trip allowlisted keys including agent", () => {
    const content = buildOpsHostEnvFileContent({
      agent: {
        agentBaseUrl: "https://ops.corretorstudio.com",
        desiredHostVersion: "abc123",
      },
      n8nEnv: {
        LEAD_FLOW_API_BASE_URL: "https://www.corretorstudio.com",
        N8N_WEBHOOK_BASE_URL: "http://n8n:5678",
        BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET: "sec-n8n",
        EVO_API_KEY: "evo-key",
        IGNORED: "nope",
      },
      evolutionEnv: {
        AUTHENTICATION_API_KEY: "evo-key",
        CONFIG_SESSION_PHONE_VERSION: "2.25.0",
      },
    })

    expect(content).toContain("# Bethânia Ops / Host — Agente VPS")
    expect(content).toContain("agentBaseUrl=https://ops.corretorstudio.com")
    expect(content).toContain("desiredHostVersion=abc123")
    expect(content).toContain("# Bethânia Ops / Host — variáveis N8N")
    expect(content).toContain("LEAD_FLOW_API_BASE_URL=https://www.corretorstudio.com")
    expect(content).toContain("AUTHENTICATION_API_KEY=evo-key")
    expect(content).not.toContain("IGNORED=")

    const parsed = parseOpsHostEnvFileContent(content)
    expect(parsed.agent.agentBaseUrl).toBe("https://ops.corretorstudio.com")
    expect(parsed.agent.desiredHostVersion).toBe("abc123")
    expect(parsed.n8nEnv.LEAD_FLOW_API_BASE_URL).toBe("https://www.corretorstudio.com")
    expect(parsed.n8nEnv.BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET).toBe("sec-n8n")
    expect(parsed.evolutionEnv.AUTHENTICATION_API_KEY).toBe("evo-key")
    expect(parsed.n8nEnv).not.toHaveProperty("IGNORED")
  })

  it("ignores comments and blank lines on import", () => {
    const parsed = parseOpsHostEnvFileContent(`
# comment
agentBaseUrl=https://ops.corretorstudio.com
desiredHostVersion=v1
LEAD_FLOW_API_BASE_URL=https://www.corretorstudio.com

AUTHENTICATION_API_KEY=abc
UNKNOWN_KEY=skip
`)
    expect(parsed.agent).toEqual({
      agentBaseUrl: "https://ops.corretorstudio.com",
      desiredHostVersion: "v1",
    })
    expect(parsed.n8nEnv).toEqual({
      LEAD_FLOW_API_BASE_URL: "https://www.corretorstudio.com",
    })
    expect(parsed.evolutionEnv).toEqual({
      AUTHENTICATION_API_KEY: "abc",
    })
  })
})
