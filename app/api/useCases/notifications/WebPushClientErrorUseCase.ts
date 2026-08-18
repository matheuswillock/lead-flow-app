import * as Sentry from "@sentry/nextjs";
import { Output } from "@/lib/output";
import { isSentryEnabled } from "@/lib/sentry/is-sentry-enabled";
import type {
  WebPushClientErrorAction,
  WebPushClientErrorPayload,
} from "@/lib/web-push/client-error-report";

const MAX_TEXT = 500;
const MAX_TAG = 200;

const ACTIONS: readonly WebPushClientErrorAction[] = ["enable", "disable"];

type ReportInput = {
  profileId: string;
  teamId: string;
  payload: WebPushClientErrorPayload;
  requestUserAgent: string | null;
};

function clip(value: string | null | undefined, max = MAX_TEXT): string | null {
  if (!value) return null;
  return value.slice(0, max);
}

function isAction(value: string): value is WebPushClientErrorAction {
  return ACTIONS.includes(value as WebPushClientErrorAction);
}

export class WebPushClientErrorUseCase {
  report(input: ReportInput): Output {
    if (!isAction(input.payload.action)) {
      return new Output(false, [], ["Ação de Web Push inválida"], null);
    }

    const record = {
      profileId: input.profileId,
      teamId: input.teamId,
      action: input.payload.action,
      errorName: clip(input.payload.errorName) ?? "Error",
      errorMessage: clip(input.payload.errorMessage) ?? "",
      userAgent: clip(input.payload.userAgent) ?? clip(input.requestUserAgent),
      uaBrands: clip(input.payload.uaBrands),
      uaPlatform: clip(input.payload.uaPlatform),
      uaMobile: input.payload.uaMobile,
      language: clip(input.payload.language),
      isSecureContext: input.payload.isSecureContext,
      protocol: clip(input.payload.protocol),
      notificationPermission: clip(input.payload.notificationPermission),
      hasPushManager: input.payload.hasPushManager,
      hasServiceWorker: input.payload.hasServiceWorker,
    };

    console.error("[WebPushClientErrorUseCase] Falha de Web Push no cliente", record);

    if (isSentryEnabled()) {
      Sentry.withScope((scope) => {
        scope.setLevel("warning");
        scope.setFingerprint([
          "web-push-client-error",
          record.action,
          record.errorName,
          record.errorMessage,
        ]);
        scope.setTag("feature", "web-push");
        scope.setTag("webPushAction", record.action);
        scope.setTag("webPushErrorName", record.errorName);
        const uaPlatformTag = record.uaPlatform?.slice(0, MAX_TAG);
        const uaBrandsTag = record.uaBrands?.slice(0, MAX_TAG);
        const permissionTag = record.notificationPermission?.slice(0, MAX_TAG);
        if (uaPlatformTag) scope.setTag("uaPlatform", uaPlatformTag);
        if (uaBrandsTag) scope.setTag("uaBrands", uaBrandsTag);
        if (permissionTag) scope.setTag("notificationPermission", permissionTag);
        scope.setContext("web_push_client_error", record);
        Sentry.captureMessage(
          `[WebPush] ${record.action} failed: ${record.errorName}: ${record.errorMessage}`,
        );
      });
    }

    return new Output(true, [], [], { recorded: true });
  }
}

export const webPushClientErrorUseCase = new WebPushClientErrorUseCase();
