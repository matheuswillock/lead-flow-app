import { describe, expect, it } from "bun:test";
import { mapEvoChannelError } from "./mapEvoChannelError";

describe("mapEvoChannelError", () => {
  it("mapeia FK Webhook_instanceId_fkey", () => {
    const msg = mapEvoChannelError(
      new Error('Foreign key constraint violated on the constraint: `Webhook_instanceId_fkey`')
    );
    expect(msg).toContain("inconsistente na Evolution");
    expect(msg).toContain("runbook");
  });

  it("mapeia instance does not exist / 404", () => {
    const msg = mapEvoChannelError(
      new Error('HTTP 404: The "bethania" instance does not exist')
    );
    expect(msg).toContain("não existe na Evolution");
  });

  it("mapeia already in use", () => {
    const msg = mapEvoChannelError(new Error("HTTP 403: instance already in use"));
    expect(msg).toContain("já está em uso");
  });

  it("mapeia QR code not available", () => {
    const msg = mapEvoChannelError(
      new Error('[BackofficeEvoApiService][getQrCode] QR code not available for instance "bethania"')
    );
    expect(msg).toContain("QR ainda não disponível");
  });

  it("mapeia erro de rede", () => {
    const msg = mapEvoChannelError(
      new Error("[BackofficeEvoApiService][createInstance] Network request failed: Error: fetch failed")
    );
    expect(msg).toContain("Evolution inacessível");
  });

  it("usa fallback por contexto", () => {
    expect(mapEvoChannelError(new Error("algo estranho"), "reconnect")).toBe(
      "Erro ao reconectar canal"
    );
    expect(mapEvoChannelError(new Error("algo estranho"), "disconnect")).toBe(
      "Erro ao desconectar canal WhatsApp"
    );
    expect(mapEvoChannelError(new Error("algo estranho"), "refresh")).toBe(
      "Erro ao atualizar status da conexão"
    );
  });
});
