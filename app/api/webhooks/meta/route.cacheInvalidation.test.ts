import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";

mock.module("next/server", () => ({ NextRequest, NextResponse, connection }));
mock.module("server-only", () => ({}));

const invalidateLeadCacheMock = mock((_input: { leadId: string; teamId: string }) => undefined);

mock.module("@/lib/cache/invalidation", () => ({
  invalidateLeadCache: invalidateLeadCacheMock,
}));

let webhookResult: Output;

const processWebhookMock = mock(async () => webhookResult);

mock.module("@/app/api/useCases/metaLeads/MetaLeadUseCase", () => ({
  metaLeadUseCase: {
    processWebhook: processWebhookMock,
    validateWebhookSignature: mock(() => true),
  },
}));

const { POST } = await import("./route");

function webhookRequest() {
  return new NextRequest("http://localhost/api/webhooks/meta", {
    method: "POST",
    headers: { "x-hub-signature-256": "sha256=fake" },
    body: JSON.stringify({ object: "page", entry: [] }),
  });
}

beforeEach(() => {
  invalidateLeadCacheMock.mockClear();
  webhookResult = new Output(true, ["ok"], [], []);
});

describe("invalidacao de cache no webhook do Meta", () => {
  it("invalida o cache de cada lead criado", async () => {
    webhookResult = new Output(true, ["2 lead(s)"], [], [
      { id: "lead-1", teamId: "team-1" },
      { id: "lead-2", teamId: "team-2" },
    ]);

    await POST(webhookRequest());

    expect(invalidateLeadCacheMock).toHaveBeenCalledTimes(2);
    expect(invalidateLeadCacheMock).toHaveBeenCalledWith({ leadId: "lead-1", teamId: "team-1" });
    expect(invalidateLeadCacheMock).toHaveBeenCalledWith({ leadId: "lead-2", teamId: "team-2" });
  });

  it("invalida tambem para lead duplicado, que recebe atividade nova", async () => {
    webhookResult = new Output(true, ["1 lead(s)"], [], [
      { id: "lead-dup", teamId: "team-1", leadCode: "L-1", name: "Fulano", email: "f@x.com" },
    ]);

    await POST(webhookRequest());

    expect(invalidateLeadCacheMock).toHaveBeenCalledWith({ leadId: "lead-dup", teamId: "team-1" });
  });

  it("ignora item sem teamId em vez de quebrar o webhook", async () => {
    webhookResult = new Output(true, [], [], [
      { id: "lead-1", teamId: "team-1" },
      { id: "lead-sem-time" },
      null,
      "lixo",
    ]);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(invalidateLeadCacheMock).toHaveBeenCalledTimes(1);
  });

  it("nao invalida quando o resultado nao e lista", async () => {
    webhookResult = new Output(false, [], ["falhou"], null);

    await POST(webhookRequest());

    expect(invalidateLeadCacheMock).not.toHaveBeenCalled();
  });

  it("responde 200 ao Meta mesmo sem lead criado", async () => {
    webhookResult = new Output(true, ["nada a processar"], [], []);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(invalidateLeadCacheMock).not.toHaveBeenCalled();
  });
});

describe("assinatura invalida", () => {
  it("nao processa nem invalida quando a assinatura falha", async () => {
    mock.module("@/app/api/useCases/metaLeads/MetaLeadUseCase", () => ({
      metaLeadUseCase: {
        processWebhook: processWebhookMock,
        validateWebhookSignature: mock(() => false),
      },
    }));

    const { POST: PostComAssinaturaInvalida } = await import("./route");
    const response = await PostComAssinaturaInvalida(webhookRequest());

    expect(response.status).toBe(403);
    expect(invalidateLeadCacheMock).not.toHaveBeenCalled();
  });
});
