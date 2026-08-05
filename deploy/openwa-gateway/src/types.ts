export type InstanceStatus =
  | { status: "INITIALIZING" }
  | { status: "QR_READY"; qr: string }
  | { status: "CONNECTED" }
  | { status: "DISCONNECTED" };

export interface MediaPayload {
  to: string;
  base64: string;
  mimetype: string;
  filename?: string;
  caption?: string;
}

export interface RemoteAuthStore {
  sessionExists(opts: { session: string }): Promise<boolean>;
  save(opts: { session: string }): Promise<void>;
  extract(opts: { session: string; path: string }): Promise<void>;
  delete(opts: { session: string }): Promise<void>;
}

export interface WhatsAppClientLike {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  sendMessage(chatId: string, content: unknown, options?: unknown): Promise<{ id: { _serialized: string } }>;
  getChatById(chatId: string): Promise<{ sendSeen(): Promise<void> }>;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

export type ClientFactory = (
  instanceName: string,
  webhookUrl: string,
  store: RemoteAuthStore
) => WhatsAppClientLike;

export interface SessionRegistry {
  upsert(instanceName: string, webhookUrl: string): Promise<void>;
  remove(instanceName: string): Promise<void>;
  list(): Promise<Array<{ instanceName: string; webhookUrl: string }>>;
}
