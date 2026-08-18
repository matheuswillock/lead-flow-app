import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { WebPushClientErrorPayload } from "@/lib/web-push/client-error-report";

const captureMessageMock = mock(() => {});
const setTagMock = mock((_key: string, _value: string) => {});

mock.module("@sentry/nextjs", () => ({
  withScope: (
    fn: (scope: {
      setLevel: (level: string) => void;
      setFingerprint: (fingerprint: string[]) => void;
      setTag: (key: string, value: string) => void;
      setContext: (key: string, context: Record<string, unknown>) => void;
    }) => void,
  ) => {
    fn({
      setLevel: () => {},
      setFingerprint: () => {},
      setTag: setTagMock,
      setContext: () => {},
    });
  },
  captureMessage: captureMessageMock,
}));

mock.module("@/lib/sentry/is-sentry-enabled", () => ({
  isSentryEnabled: () => true,
}));

const { WebPushClientErrorUseCase } = await import("./WebPushClientErrorUseCase");

const payload: WebPushClientErrorPayload = {
  action: "enable",
  errorName: "AbortError",
  errorMessage: "Registration failed - push service not available",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0",
  uaBrands: "Chromium/128, Google Chrome/128",
  uaPlatform: "Linux",
  uaMobile: false,
  language: "pt-BR",
  isSecureContext: true,
  protocol: "http:",
  notificationPermission: "granted",
  hasPushManager: true,
  hasServiceWorker: true,
};

describe("WebPushClientErrorUseCase", () => {
  afterEach(() => {
    captureMessageMock.mockClear();
    setTagMock.mockClear();
  });

  it("logs browser context for Vercel Runtime Logs", () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    try {
      const output = new WebPushClientErrorUseCase().report({
        profileId: "profile-1",
        teamId: "team-1",
        payload,
        requestUserAgent: "Mozilla/5.0 header-ua",
      });

      expect(output.isValid).toBe(true);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0]?.[0]).toBe(
        "[WebPushClientErrorUseCase] Falha de Web Push no cliente",
      );
      expect(errorSpy.mock.calls[0]?.[1]).toMatchObject({
        profileId: "profile-1",
        teamId: "team-1",
        action: "enable",
        errorName: "AbortError",
        errorMessage: "Registration failed - push service not available",
        uaBrands: "Chromium/128, Google Chrome/128",
        uaPlatform: "Linux",
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("sends Sentry warning tagged with browser brands", () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    try {
      new WebPushClientErrorUseCase().report({
        profileId: "profile-1",
        teamId: "team-1",
        payload,
        requestUserAgent: null,
      });

      expect(captureMessageMock).toHaveBeenCalledTimes(1);
      expect(setTagMock).toHaveBeenCalledWith("uaBrands", "Chromium/128, Google Chrome/128");
      expect(setTagMock).toHaveBeenCalledWith("uaPlatform", "Linux");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("rejects an invalid action", () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    try {
      const output = new WebPushClientErrorUseCase().report({
        profileId: "profile-1",
        teamId: "team-1",
        payload: { ...payload, action: "subscribe" as WebPushClientErrorPayload["action"] },
        requestUserAgent: null,
      });

      expect(output.isValid).toBe(false);
      expect(errorSpy).not.toHaveBeenCalled();
      expect(captureMessageMock).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
