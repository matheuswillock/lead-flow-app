import { WebhookDispatcher } from "../webhook/WebhookDispatcher.js";
import type { ClientFactory, InstanceStatus, RemoteAuthStore, WhatsAppClientLike } from "../types.js";
import { SupabaseRemoteAuthStore } from "./SupabaseRemoteAuth.js";
import { config } from "../config.js";

function toGatewayChatId(remoteJid: string): string {
  if (remoteJid.endsWith("@s.whatsapp.net")) {
    return `${remoteJid.slice(0, -"@s.whatsapp.net".length)}@c.us`;
  }
  return remoteJid;
}

function toProductJid(wwebJid: string): string {
  if (wwebJid.endsWith("@c.us")) {
    return `${wwebJid.slice(0, -"@c.us".length)}@s.whatsapp.net`;
  }
  return wwebJid;
}

function requireClient(instanceName: string, clients: Map<string, WhatsAppClientLike>) {
  const client = clients.get(instanceName);
  if (!client) throw new Error(`Instância ${instanceName} não encontrada`);
  return client as WhatsAppClientLike & {
    getChats(): Promise<Array<Record<string, unknown>>>;
    getContacts(): Promise<Array<Record<string, unknown>>>;
    getChatById(chatId: string): Promise<{
      fetchMessages(opts: { limit: number }): Promise<Array<Record<string, unknown>>>;
      participants?: Array<Record<string, unknown>>;
    }>;
  };
}

function serializeMessage(msg: unknown): unknown {
  if (!msg || typeof msg !== "object") return msg;
  const m = msg as Record<string, unknown>;
  return {
    id: (m.id as { _serialized?: string })?._serialized,
    body: m.body,
    from: m.from,
    to: m.to,
    timestamp: m.timestamp,
    hasMedia: m.hasMedia,
    type: m.type,
  };
}

function defaultClientFactory(
  instanceName: string,
  _webhookUrl: string,
  store: RemoteAuthStore
): WhatsAppClientLike {
  // Importação dinâmica para evitar erro em ambiente de teste sem Chromium
  const { Client, RemoteAuth } = require("whatsapp-web.js");
  return new Client({
    authStrategy: new RemoteAuth({
      store,
      session: instanceName,
      backupSyncIntervalMs: 300_000,
    }),
    puppeteer: {
      headless: true,
      executablePath: config.chromiumPath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
    },
  });
}

export class SessionManager {
  private readonly clients = new Map<string, WhatsAppClientLike>();
  private readonly states = new Map<string, InstanceStatus>();
  private readonly webhooks = new Map<string, string>();

  constructor(
    private readonly clientFactory: ClientFactory = defaultClientFactory,
    private readonly storeFactory: () => RemoteAuthStore = () => new SupabaseRemoteAuthStore()
  ) {}

  async startSession(instanceName: string, webhookUrl: string): Promise<void> {
    if (this.clients.has(instanceName)) return;

    this.webhooks.set(instanceName, webhookUrl);
    this.states.set(instanceName, { status: "INITIALIZING" });

    const store = this.storeFactory();
    const dispatcher = new WebhookDispatcher();
    const client = this.clientFactory(instanceName, webhookUrl, store);

    client.on("qr", (qr: unknown) => {
      this.states.set(instanceName, { status: "QR_READY", qr: qr as string });
      dispatcher.send(webhookUrl, instanceName, "qr", { qr });
    });

    client.on("ready", () => {
      this.states.set(instanceName, { status: "CONNECTED" });
      dispatcher.send(webhookUrl, instanceName, "ready", {});
    });

    client.on("disconnected", (reason: unknown) => {
      this.states.set(instanceName, { status: "DISCONNECTED" });
      dispatcher.send(webhookUrl, instanceName, "disconnected", { reason });
    });

    client.on("message", (msg: unknown) => {
      dispatcher.send(webhookUrl, instanceName, "message", serializeMessage(msg));
    });

    client.on("message_ack", (msg: unknown, ack: unknown) => {
      dispatcher.send(webhookUrl, instanceName, "message_ack", {
        id: (msg as { id: { _serialized: string } })?.id?._serialized,
        ack,
      });
    });

    this.clients.set(instanceName, client);
    // initialize() é assíncrono mas não bloqueamos a rota — eventos chegam via callbacks
    client.initialize().catch((err: unknown) => {
      console.error(`[SessionManager] initialize falhou para ${instanceName}`, err);
      this.states.set(instanceName, { status: "DISCONNECTED" });
    });
  }

  getStatus(instanceName: string): InstanceStatus {
    return this.states.get(instanceName) ?? { status: "DISCONNECTED" };
  }

  async deleteSession(instanceName: string): Promise<void> {
    const client = this.clients.get(instanceName);
    if (client) {
      try {
        await client.destroy();
      } catch {
        // client já pode estar destruído
      }
      this.clients.delete(instanceName);
    }
    const store = this.storeFactory();
    await store.delete({ session: instanceName });
    this.states.delete(instanceName);
    this.webhooks.delete(instanceName);
  }

  async sendText(instanceName: string, to: string, text: string): Promise<string> {
    const client = this.clients.get(instanceName);
    if (!client) throw new Error(`Instância ${instanceName} não encontrada`);
    const chatId = to.includes("@c.us") ? to : `${to}@c.us`;
    const msg = await client.sendMessage(chatId, text);
    return msg.id._serialized;
  }

  async sendMedia(
    instanceName: string,
    to: string,
    media: { base64: string; mimetype: string; filename?: string; caption?: string }
  ): Promise<string> {
    const client = this.clients.get(instanceName);
    if (!client) throw new Error(`Instância ${instanceName} não encontrada`);
    const { MessageMedia } = require("whatsapp-web.js");
    const chatId = to.includes("@c.us") ? to : `${to}@c.us`;
    const wwebMedia = new MessageMedia(media.mimetype, media.base64, media.filename);
    const msg = await client.sendMessage(chatId, wwebMedia, { caption: media.caption });
    return msg.id._serialized;
  }

  async markChatSeen(instanceName: string, chatId: string): Promise<void> {
    const client = this.clients.get(instanceName);
    if (!client) return;
    const normalizedId = toGatewayChatId(chatId);
    const chat = await client.getChatById(normalizedId);
    await chat.sendSeen();
  }

  async fetchChats(instanceName: string) {
    const client = requireClient(instanceName, this.clients);
    const chats = await client.getChats();
    return chats.map((chat) => {
      const id = (chat.id as { _serialized?: string })?._serialized ?? "";
      return {
        remoteJid: toProductJid(id),
        pushName: typeof chat.name === "string" ? chat.name : null,
        subject: chat.isGroup && typeof chat.name === "string" ? chat.name : null,
        profilePicUrl: null,
        updatedAt:
          typeof chat.timestamp === "number"
            ? new Date(chat.timestamp * 1000).toISOString()
            : null,
      };
    });
  }

  async fetchContacts(instanceName: string) {
    const client = requireClient(instanceName, this.clients);
    const contacts = await client.getContacts();
    return contacts.map((contact) => {
      const id = (contact.id as { _serialized?: string })?._serialized ?? "";
      const number = typeof contact.number === "string" ? contact.number : null;
      return {
        remoteJid: toProductJid(id),
        pushName: typeof contact.pushname === "string" ? contact.pushname : null,
        phoneNumber: number,
      };
    });
  }

  async fetchMessagesSince(instanceName: string, remoteJid: string, sinceIso: string) {
    const client = requireClient(instanceName, this.clients);
    const since = new Date(sinceIso);
    const chat = await client.getChatById(toGatewayChatId(remoteJid));
    const messages = await chat.fetchMessages({ limit: 200 });
    return messages
      .filter((msg) => {
        const ts = typeof msg.timestamp === "number" ? msg.timestamp * 1000 : 0;
        return ts >= since.getTime();
      })
      .map((msg) => {
        const id = (msg.id as { _serialized?: string })?._serialized ?? "";
        const ts = typeof msg.timestamp === "number" ? msg.timestamp * 1000 : Date.now();
        return {
          providerMessageId: id,
          remoteJid,
          fromMe: Boolean(msg.fromMe),
          messageTimestamp: new Date(ts).toISOString(),
          body: typeof msg.body === "string" ? msg.body : null,
          hasMedia: Boolean(msg.hasMedia),
          type: typeof msg.type === "string" ? msg.type : "unknown",
          senderDisplayName:
            typeof msg._data === "object" &&
            msg._data !== null &&
            typeof (msg._data as Record<string, unknown>).notifyName === "string"
              ? ((msg._data as Record<string, unknown>).notifyName as string)
              : null,
        };
      });
  }

  async fetchGroupParticipants(instanceName: string, groupJid: string) {
    const client = requireClient(instanceName, this.clients);
    const chat = await client.getChatById(toGatewayChatId(groupJid));
    const participants = chat.participants ?? [];
    return participants.map((participant) => {
      const id = (participant.id as { _serialized?: string })?._serialized ?? "";
      return {
        remoteJid: toProductJid(id),
        pushName: typeof participant.pushname === "string" ? participant.pushname : null,
        phoneNumber: null,
        admin: typeof participant.isAdmin === "boolean" && participant.isAdmin ? "admin" : null,
      };
    });
  }
}

export const sessionManager = new SessionManager();
