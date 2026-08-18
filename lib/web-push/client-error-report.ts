export type WebPushClientErrorAction = "enable" | "disable";

export type WebPushClientErrorPayload = {
  action: WebPushClientErrorAction;
  errorName: string;
  errorMessage: string;
  userAgent: string | null;
  uaBrands: string | null;
  uaPlatform: string | null;
  uaMobile: boolean | null;
  language: string | null;
  isSecureContext: boolean | null;
  protocol: string | null;
  notificationPermission: string | null;
  hasPushManager: boolean;
  hasServiceWorker: boolean;
};

type NavigatorUAData = {
  brands?: Array<{ brand: string; version: string }>;
  mobile?: boolean;
  platform?: string;
};

type NavigatorWithUAData = Navigator & {
  userAgentData?: NavigatorUAData;
};

export function serializeUnknownError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "",
    };
  }

  if (typeof error === "string") {
    return { name: "Error", message: error };
  }

  return { name: "UnknownError", message: "" };
}

export function formatUaBrands(brands: NavigatorUAData["brands"]): string | null {
  if (!brands?.length) return null;
  return brands.map((brand) => `${brand.brand}/${brand.version}`).join(", ");
}

export function collectWebPushBrowserSnapshot(): Omit<
  WebPushClientErrorPayload,
  "action" | "errorName" | "errorMessage"
> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      userAgent: null,
      uaBrands: null,
      uaPlatform: null,
      uaMobile: null,
      language: null,
      isSecureContext: null,
      protocol: null,
      notificationPermission: null,
      hasPushManager: false,
      hasServiceWorker: false,
    };
  }

  const navigatorWithUa = navigator as NavigatorWithUAData;
  const uaData = navigatorWithUa.userAgentData;

  return {
    userAgent: navigator.userAgent || null,
    uaBrands: formatUaBrands(uaData?.brands),
    uaPlatform: uaData?.platform ?? null,
    uaMobile: typeof uaData?.mobile === "boolean" ? uaData.mobile : null,
    language: navigator.language || null,
    isSecureContext: window.isSecureContext,
    protocol: window.location.protocol || null,
    notificationPermission:
      "Notification" in window ? Notification.permission : "unsupported",
    hasPushManager: "PushManager" in window,
    hasServiceWorker: "serviceWorker" in navigator,
  };
}

export function buildWebPushClientErrorPayload(
  error: unknown,
  action: WebPushClientErrorAction,
): WebPushClientErrorPayload {
  const serialized = serializeUnknownError(error);
  return {
    action,
    errorName: serialized.name,
    errorMessage: serialized.message,
    ...collectWebPushBrowserSnapshot(),
  };
}
