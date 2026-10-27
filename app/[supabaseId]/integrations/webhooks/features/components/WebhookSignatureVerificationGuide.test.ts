import { describe, expect, it } from "bun:test";
import vm from "node:vm";
import crypto from "node:crypto";
import { NODE_VERIFY_SAMPLE } from "./WebhookSignatureVerificationGuide";

/**
 * R20-5 (revisão SPEC 20): o guia de verificação mostrado na tela precisa se
 * comportar exatamente como o texto exibido, contra assinaturas reais e
 * contra entradas malformadas (header ausente, header de outro tamanho) —
 * sem lançar exceção, sempre devolvendo um booleano.
 *
 * Este teste importa a string `NODE_VERIFY_SAMPLE` de verdade do componente
 * (o mesmo valor exibido na tela, já resolvido pelo template literal — não um
 * recorte do arquivo-fonte) e a executa num sandbox `vm`, para que uma futura
 * edição do texto do guia sem atualizar este teste quebre a suíte, em vez de
 * o guia divergir silenciosamente do que o código real faz.
 */
function loadIsValidSignatureFromGuide(): (
  secret: string,
  timestamp: string,
  rawBody: string,
  signatureHeader: string
) => boolean {
  // O texto exibido na tela usa `import` (ESM), porque é o que um destino Node.js
  // moderno usa. Um sandbox `vm` roda como script CommonJS, então a única troca é
  // a forma de trazer `crypto` para dentro — a função verificada é o texto literal
  // do guia, sem nenhuma outra edição.
  const importLine = 'import crypto from "node:crypto";';
  if (!NODE_VERIFY_SAMPLE.startsWith(importLine)) {
    throw new Error(
      "NODE_VERIFY_SAMPLE mudou o import de crypto — atualize este teste junto com o guia."
    );
  }
  const sampleAsCommonJs = NODE_VERIFY_SAMPLE.slice(importLine.length);

  const context = vm.createContext({ require, Buffer, crypto, module: { exports: {} } });
  vm.runInContext(`${sampleAsCommonJs}\nmodule.exports = isValidCorretorStudioSignature;`, context);
  return context.module.exports;
}

describe("WebhookSignatureVerificationGuide — texto do NODE_VERIFY_SAMPLE contra entrega real", () => {
  const isValidCorretorStudioSignature = loadIsValidSignatureFromGuide();

  it("aceita uma assinatura real gerada com o mesmo segredo", () => {
    const secret = "guide-real-secret";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = JSON.stringify({ id: "evt_guide", data: { lead: { name: "Ana" } } });
    const signature =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

    expect(isValidCorretorStudioSignature(secret, timestamp, rawBody, signature)).toBe(true);
  });

  it("recusa segredo errado", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = JSON.stringify({ id: "evt_guide" });
    const signature =
      "sha256=" +
      crypto.createHmac("sha256", "segredo-certo").update(`${timestamp}.${rawBody}`).digest("hex");

    expect(isValidCorretorStudioSignature("segredo-errado", timestamp, rawBody, signature)).toBe(
      false
    );
  });

  it("timestamp não numérico devolve false, nunca vira NaN passando pela janela de 5 minutos", () => {
    const signature = "sha256=" + "0".repeat(64);
    expect(
      isValidCorretorStudioSignature("secret", "não-e-um-numero", "{}", signature)
    ).toBe(false);
  });

  it("R20-5: header de assinatura ausente devolve false, nunca lança exceção", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    expect(() =>
      isValidCorretorStudioSignature("secret", timestamp, "{}", undefined as unknown as string)
    ).not.toThrow();
    expect(isValidCorretorStudioSignature("secret", timestamp, "{}", undefined as unknown as string)).toBe(
      false
    );
  });

  it("R20-5: header de assinatura com tamanho diferente devolve false, nunca lança exceção", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    expect(() =>
      isValidCorretorStudioSignature("secret", timestamp, "{}", "sha256=curto-demais")
    ).not.toThrow();
    expect(isValidCorretorStudioSignature("secret", timestamp, "{}", "sha256=curto-demais")).toBe(
      false
    );
  });

  it("recusa timestamp fora da janela de 5 minutos", () => {
    const secret = "guide-real-secret";
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 6 * 60).toString();
    const rawBody = "{}";
    const signature =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(`${oldTimestamp}.${rawBody}`).digest("hex");

    expect(isValidCorretorStudioSignature(secret, oldTimestamp, rawBody, signature)).toBe(false);
  });
});
