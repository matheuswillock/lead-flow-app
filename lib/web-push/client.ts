import { SERVICE_WORKER_PATH } from "./constants";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return undefined;
  }

  return navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
}

export class WebPushServiceWorkerNotReadyError extends Error {
  constructor() {
    super("Service worker not ready");
    this.name = "WebPushServiceWorkerNotReadyError";
  }
}

export async function registerWebPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service Worker não suportado neste navegador.");
  }

  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
  await navigator.serviceWorker.ready;

  if (!registration.active) {
    throw new WebPushServiceWorkerNotReadyError();
  }

  return registration;
}
