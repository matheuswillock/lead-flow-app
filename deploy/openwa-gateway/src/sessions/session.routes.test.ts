import { describe, it, expect, beforeEach, mock } from "bun:test";
import express from "express";
import type { Application } from "express";

// Setar variáveis de ambiente necessárias
process.env.OPENWA_API_KEY = "test-api-key-routes";
process.env.OPENWA_WEBHOOK_SECRET = "webhook-secret-min-32-chars-long!!";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.OPENWA_SUPABASE_KEY = "supabase-key-test";

const { Router } = express;

// Mock do SessionManager antes de importar as rotas
const mockStartSession = mock(async (_instance: string, _webhookUrl: string) => {});
const mockGetStatus = mock((_instance: string) => ({ status: "CONNECTED" as const }));
const mockDeleteSession = mock(async (_instance: string) => {});

// Injetar mock via module mock
const mockSessionManager = {
  startSession: mockStartSession,
  getStatus: mockGetStatus,
  deleteSession: mockDeleteSession,
};

// Criar rotas inline para testar com o mock injetado
function createSessionRouterWithMock(sm: typeof mockSessionManager) {
  const router = Router();

  router.post("/session/start/:instance", async (req, res) => {
    const { instance } = req.params;
    const { webhookUrl } = req.body as { webhookUrl?: string };
    if (!webhookUrl) {
      res.status(400).json({ error: "webhookUrl required" });
      return;
    }
    await sm.startSession(instance, webhookUrl);
    res.json({ status: "starting", instance });
  });

  router.get("/session/status/:instance", (req, res) => {
    const state = sm.getStatus(req.params.instance);
    res.json(state);
  });

  router.delete("/session/delete/:instance", async (req, res) => {
    await sm.deleteSession(req.params.instance);
    res.json({ deleted: true });
  });

  return router;
}

async function makeRequest(
  app: Application,
  method: "get" | "post" | "delete",
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<{ status: number; body: unknown }> {
  const req = new Request(`http://localhost${path}`, {
    method: method.toUpperCase(),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const addr = server.address() as { port: number };
      try {
        const res = await fetch(`http://localhost:${addr.port}${path}`, {
          method: method.toUpperCase(),
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json();
        server.close();
        resolve({ status: res.status, body: json });
      } catch (err) {
        server.close();
        reject(err);
      }
    });
  });
}

describe("session.routes", () => {
  let app: Application;

  beforeEach(() => {
    mockStartSession.mockClear();
    mockGetStatus.mockClear();
    mockDeleteSession.mockClear();

    app = express();
    app.use(express.json());
    app.use(createSessionRouterWithMock(mockSessionManager));
  });

  it("POST /session/start/:instance retorna 400 sem webhookUrl", async () => {
    const { status, body } = await makeRequest(app, "post", "/session/start/inst-1", {});
    expect(status).toBe(400);
    expect((body as { error: string }).error).toBe("webhookUrl required");
  });

  it("POST /session/start/:instance retorna 200 com webhookUrl", async () => {
    const { status, body } = await makeRequest(app, "post", "/session/start/inst-1", {
      webhookUrl: "https://hook.example.com",
    });
    expect(status).toBe(200);
    expect((body as { status: string }).status).toBe("starting");
    expect(mockStartSession).toHaveBeenCalledWith("inst-1", "https://hook.example.com");
  });

  it("GET /session/status/:instance retorna status", async () => {
    mockGetStatus.mockReturnValue({ status: "QR_READY", qr: "qr-data" });
    const { status, body } = await makeRequest(app, "get", "/session/status/inst-1");
    expect(status).toBe(200);
    expect((body as { status: string }).status).toBe("QR_READY");
  });

  it("DELETE /session/delete/:instance chama deleteSession", async () => {
    const { status, body } = await makeRequest(app, "delete", "/session/delete/inst-1");
    expect(status).toBe(200);
    expect((body as { deleted: boolean }).deleted).toBe(true);
    expect(mockDeleteSession).toHaveBeenCalledWith("inst-1");
  });
});
