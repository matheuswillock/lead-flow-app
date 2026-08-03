import { describe, it, expect, beforeEach } from "bun:test";
import type { Request, Response, NextFunction } from "express";

// Setar variáveis antes de importar o módulo
process.env.OPENWA_API_KEY = "test-secret-key-123";
process.env.OPENWA_WEBHOOK_SECRET = "webhook-secret-min-32-chars-long!!";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.OPENWA_SUPABASE_KEY = "supabase-key-test";

const { authMiddleware } = await import("./auth.middleware.js");

function makeResMock(): { status: ReturnType<typeof jest.fn>; json: ReturnType<typeof jest.fn>; _status: number; _body: unknown } {
  const mock: { status: (code: number) => typeof mock; json: (body: unknown) => typeof mock; _status: number; _body: unknown } = {
    _status: 200,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
  return mock as unknown as ReturnType<typeof jest.fn> & typeof mock;
}

describe("authMiddleware", () => {
  it("chama next() quando apikey é válida", () => {
    let called = false;
    const req = { headers: { apikey: "test-secret-key-123" } } as unknown as Request;
    const res = makeResMock() as unknown as Response;
    const next: NextFunction = () => { called = true; };

    authMiddleware(req, res, next);

    expect(called).toBe(true);
  });

  it("retorna 401 quando apikey é inválida", () => {
    let called = false;
    const req = { headers: { apikey: "wrong-key" } } as unknown as Request;
    const res = makeResMock();
    const next: NextFunction = () => { called = true; };

    authMiddleware(req, res as unknown as Response, next);

    expect(called).toBe(false);
    expect((res as unknown as { _status: number })._status).toBe(401);
  });

  it("retorna 401 quando apikey está ausente", () => {
    let called = false;
    const req = { headers: {} } as unknown as Request;
    const res = makeResMock();
    const next: NextFunction = () => { called = true; };

    authMiddleware(req, res as unknown as Response, next);

    expect(called).toBe(false);
    expect((res as unknown as { _status: number })._status).toBe(401);
  });
});
