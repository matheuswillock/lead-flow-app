import { describe, expect, it } from "bun:test";
import { WebPushServiceWorkerNotReadyError } from "./client";
import { resolveWebPushUserErrorMessage } from "./resolve-user-error-message";

describe("resolveWebPushUserErrorMessage", () => {
  it("maps AbortError with no active Service Worker for enable", () => {
    const error = new DOMException(
      "Failed to execute 'subscribe' on 'PushManager': Subscription failed - no active Service Worker",
      "AbortError",
    );

    expect(resolveWebPushUserErrorMessage(error, "enable")).toBe(
      "O navegador ainda está preparando as notificações. Aguarde alguns segundos, recarregue a página e tente novamente.",
    );
  });

  it("maps service worker script evaluation failure", () => {
    const error = new Error(
      "Failed to register a ServiceWorker: ServiceWorker script evaluation failed",
    );

    expect(resolveWebPushUserErrorMessage(error, "enable")).toBe(
      "Não foi possível carregar as notificações neste navegador. Recarregue a página e tente de novo.",
    );
  });

  it("maps push service unavailable", () => {
    const error = new DOMException(
      "Registration failed - push service not available",
      "AbortError",
    );

    expect(resolveWebPushUserErrorMessage(error, "enable")).toBe(
      "Este navegador não tem serviço de push disponível. Tente o Chrome ou o Edge, com notificações liberadas.",
    );
  });

  it("maps WebPushServiceWorkerNotReadyError", () => {
    expect(resolveWebPushUserErrorMessage(new WebPushServiceWorkerNotReadyError(), "enable")).toBe(
      "O navegador ainda está preparando as notificações. Aguarde alguns segundos, recarregue a página e tente novamente.",
    );
  });

  it("returns enable fallback for unknown errors", () => {
    expect(resolveWebPushUserErrorMessage(new Error("unexpected"), "enable")).toBe(
      "Não foi possível ativar as notificações no navegador. Tente recarregar a página.",
    );
  });

  it("returns disable fallback for unknown errors", () => {
    expect(resolveWebPushUserErrorMessage(new Error("unexpected"), "disable")).toBe(
      "Não foi possível desativar as notificações no navegador. Tente recarregar a página.",
    );
  });
});
