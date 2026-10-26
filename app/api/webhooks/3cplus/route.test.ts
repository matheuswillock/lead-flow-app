import { describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";

const { POST, GET } = await import("./route");

const request = (body: string) =>
  new NextRequest("https://app.test/api/webhooks/3cplus", { method: "POST", body });

describe("/api/webhooks/3cplus (V17, SPEC 11 A-E7)", () => {
  it("responde 410 apontando para o webhook v2, em vez de aceitar qualquer corpo com 200", async () => {
    const response = await POST(request('{"lead":{"name":"Maria"}}'));
    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.error).toBe("gone");
    expect(body.message).toContain("/api/webhooks/studio/v2/");
  });

  it("não lê nem registra o corpo recebido (o payload podia conter PII)", async () => {
    const info = mock(() => undefined);
    const original = console.info;
    console.info = info as never;
    try {
      const incoming = request('{"lead":{"name":"Maria Secreta"}}');
      const textSpy = mock(incoming.text.bind(incoming));
      incoming.text = textSpy as never;
      await POST(incoming);
      expect(textSpy).not.toHaveBeenCalled();
      expect(info).not.toHaveBeenCalled();
    } finally {
      console.info = original;
    }
  });

  it("qualquer outro método também é 410", async () => {
    expect((await GET()).status).toBe(410);
  });
});
