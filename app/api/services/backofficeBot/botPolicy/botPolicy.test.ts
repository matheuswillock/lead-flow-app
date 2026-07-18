import { describe, expect, it } from "bun:test";
import { isAllowedBotAction } from "./allowlist";
import { buildActionIdempotencyKey, buildInboundIdempotencyKey } from "./idempotency";
import { sanitizeInboundMessage } from "./sanitize-inbound";
import { assertTeamScope } from "./team-scope";

describe("botPolicy allowlist", () => {
  it("permite ações conhecidas e bloqueia desconhecidas", () => {
    expect(isAllowedBotAction("list_leads")).toBe(true);
    expect(isAllowedBotAction("drop_database")).toBe(false);
  });
});

describe("botPolicy assertTeamScope", () => {
  it("usa sessão e rejeita teamId divergente", () => {
    expect(
      assertTeamScope({
        sessionTeamId: "team-a",
        activeTeamId: "team-b",
        requestedTeamId: "team-a",
        isTeamMember: true,
      })
    ).toEqual({ ok: true, teamId: "team-a" });

    expect(
      assertTeamScope({
        sessionTeamId: "team-a",
        activeTeamId: "team-a",
        requestedTeamId: "team-other",
        isTeamMember: true,
      })
    ).toEqual({ ok: false, errorCode: "TEAM_SCOPE_VIOLATION" });
  });

  it("rejeita sem membership", () => {
    expect(
      assertTeamScope({
        sessionTeamId: "team-a",
        activeTeamId: "team-a",
        isTeamMember: false,
      })
    ).toEqual({ ok: false, errorCode: "TEAM_SCOPE_VIOLATION" });
  });
});

describe("botPolicy sanitizeInboundMessage", () => {
  it("rejeita padrões de SQL injection", () => {
    expect(sanitizeInboundMessage("' OR 1=1 -- ").ok).toBe(false);
    expect(sanitizeInboundMessage("UNION SELECT * FROM users").ok).toBe(false);
    expect(sanitizeInboundMessage("; DROP TABLE leads").ok).toBe(false);
  });

  it("aceita texto normal em pt-BR", () => {
    const result = sanitizeInboundMessage("preciso do lead do João");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("preciso do lead do João");
  });
});

describe("botPolicy idempotency", () => {
  it("usa a chave de entrega para deduplicar uma ação", () => {
    const key = buildActionIdempotencyKey({
      userLinkId: "link-1",
      action: "add_note",
      teamId: "team-1",
      channelMessageId: "delivery-1",
    });
    expect(key).toBe("bot-action:delivery-1:add_note");
  });

  it("não deduplica ações sem uma chave por entrega", () => {
    expect(buildActionIdempotencyKey({
      userLinkId: "link-1",
      action: "add_note",
      teamId: "team-1",
    })).toBeNull();
  });

  it("buildInboundIdempotencyKey preserva channelMessageId", () => {
    expect(buildInboundIdempotencyKey("  msg-123  ")).toBe("msg-123");
  });
});
