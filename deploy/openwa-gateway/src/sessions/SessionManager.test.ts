import { describe, it, expect, mock, beforeEach } from "bun:test";
import { SessionManager } from "./SessionManager.js";
import type { ClientFactory, RemoteAuthStore, SessionRegistry, WhatsAppClientLike } from "../types.js";

function makeStoreMock(opts?: { exists?: boolean }): RemoteAuthStore & { deleteCalls: string[] } {
  const deleteCalls: string[] = [];
  return {
    deleteCalls,
    sessionExists: async () => opts?.exists ?? false,
    save: async () => {},
    extract: async () => {},
    delete: async ({ session }: { session: string }) => {
      deleteCalls.push(session);
    },
  };
}

function makeRegistryMock(): SessionRegistry & {
  entries: Map<string, string>;
  upsertCalls: Array<{ instanceName: string; webhookUrl: string }>;
  removeCalls: string[];
} {
  const entries = new Map<string, string>();
  const upsertCalls: Array<{ instanceName: string; webhookUrl: string }> = [];
  const removeCalls: string[] = [];
  return {
    entries,
    upsertCalls,
    removeCalls,
    upsert: async (instanceName: string, webhookUrl: string) => {
      upsertCalls.push({ instanceName, webhookUrl });
      entries.set(instanceName, webhookUrl);
    },
    remove: async (instanceName: string) => {
      removeCalls.push(instanceName);
      entries.delete(instanceName);
    },
    list: async () =>
      [...entries.entries()].map(([instanceName, webhookUrl]) => ({ instanceName, webhookUrl })),
  };
}

type EventMap = Record<string, ((...args: unknown[]) => void)[]>;

function makeClientMock(): WhatsAppClientLike & {
  _events: EventMap;
  _initCalled: boolean;
  _destroyCalled: boolean;
  _sentMessages: Array<{ chatId: string; content: unknown }>;
  _chatsSeen: string[];
  _emit(event: string, ...args: unknown[]): void;
} {
  const _events: EventMap = {};
  const _sentMessages: Array<{ chatId: string; content: unknown }> = [];
  const _chatsSeen: string[] = [];

  const client = {
    _events,
    _initCalled: false,
    _destroyCalled: false,
    _sentMessages,
    _chatsSeen,

    _emit(event: string, ...args: unknown[]) {
      (_events[event] ?? []).forEach((fn) => fn(...args));
    },

    on(event: string, listener: (...args: unknown[]) => void) {
      if (!_events[event]) _events[event] = [];
      _events[event].push(listener);
      return client as unknown as WhatsAppClientLike;
    },

    async initialize() {
      client._initCalled = true;
    },

    async destroy() {
      client._destroyCalled = true;
    },

    async sendMessage(chatId: string, content: unknown) {
      _sentMessages.push({ chatId, content });
      return { id: { _serialized: `msg-id-${_sentMessages.length}` } };
    },

    async getChatById(chatId: string) {
      return {
        sendSeen: async () => {
          _chatsSeen.push(chatId);
        },
      };
    },
  };

  return client;
}

describe("SessionManager", () => {
  let store: ReturnType<typeof makeStoreMock>;
  let registry: ReturnType<typeof makeRegistryMock>;
  let client: ReturnType<typeof makeClientMock>;
  let manager: SessionManager;

  beforeEach(() => {
    store = makeStoreMock();
    registry = makeRegistryMock();
    client = makeClientMock();
    const factory: ClientFactory = () => client;
    manager = new SessionManager(factory, () => store, () => registry);
  });

  it("startSession inicializa o client", async () => {
    await manager.startSession("inst-1", "https://hook.example.com");
    await new Promise((r) => setTimeout(r, 10));
    expect(client._initCalled).toBe(true);
  });

  it("startSession persiste webhook no registry", async () => {
    await manager.startSession("inst-1", "https://hook.example.com");
    expect(registry.upsertCalls).toContainEqual({
      instanceName: "inst-1",
      webhookUrl: "https://hook.example.com",
    });
  });

  it("startSession é idempotente (não reinicia sessão existente)", async () => {
    await manager.startSession("inst-1", "https://hook.example.com");
    await manager.startSession("inst-1", "https://hook.example.com");
    expect(client._initCalled).toBe(true);
  });

  it("getStatus retorna INITIALIZING após startSession", async () => {
    await manager.startSession("inst-1", "https://hook.example.com");
    const status = manager.getStatus("inst-1");
    expect(status.status).toBe("INITIALIZING");
  });

  it("getStatus retorna DISCONNECTED para instância desconhecida", () => {
    const status = manager.getStatus("nao-existe");
    expect(status.status).toBe("DISCONNECTED");
  });

  it("atualiza estado para CONNECTED quando evento ready emitido", async () => {
    await manager.startSession("inst-1", "https://hook.example.com");
    client._emit("ready");
    expect(manager.getStatus("inst-1").status).toBe("CONNECTED");
  });

  it("atualiza estado para QR_READY quando evento qr emitido", async () => {
    await manager.startSession("inst-1", "https://hook.example.com");
    client._emit("qr", "data:image/png;base64,abc123");
    const status = manager.getStatus("inst-1");
    expect(status.status).toBe("QR_READY");
    if (status.status === "QR_READY") {
      expect(status.qr).toBe("data:image/png;base64,abc123");
    }
  });

  it("atualiza estado para DISCONNECTED quando evento disconnected emitido", async () => {
    await manager.startSession("inst-1", "https://hook.example.com");
    client._emit("disconnected", "LOGOUT");
    expect(manager.getStatus("inst-1").status).toBe("DISCONNECTED");
  });

  it("deleteSession chama destroy, store.delete e registry.remove", async () => {
    await manager.startSession("inst-1", "https://hook.example.com");
    await manager.deleteSession("inst-1");
    expect(client._destroyCalled).toBe(true);
    expect(store.deleteCalls).toContain("inst-1");
    expect(registry.removeCalls).toContain("inst-1");
  });

  it("deleteSession limpa o estado da instância", async () => {
    await manager.startSession("inst-1", "https://hook.example.com");
    client._emit("ready");
    await manager.deleteSession("inst-1");
    expect(manager.getStatus("inst-1").status).toBe("DISCONNECTED");
  });

  it("sendText formata chatId com @c.us", async () => {
    await manager.startSession("inst-1", "https://hook.example.com");
    await manager.sendText("inst-1", "5511999991111", "oi");
    expect(client._sentMessages[0].chatId).toBe("5511999991111@c.us");
  });

  it("sendText converte @s.whatsapp.net para @c.us", async () => {
    await manager.startSession("inst-1", "https://hook.example.com");
    await manager.sendText("inst-1", "5511999991111@s.whatsapp.net", "oi");
    expect(client._sentMessages[0].chatId).toBe("5511999991111@c.us");
  });

  it("sendText não duplica @c.us quando já presente", async () => {
    await manager.startSession("inst-1", "https://hook.example.com");
    await manager.sendText("inst-1", "5511999991111@c.us", "oi");
    expect(client._sentMessages[0].chatId).toBe("5511999991111@c.us");
  });

  it("sendText lança quando instância não existe", async () => {
    await expect(manager.sendText("nao-existe", "5511", "oi")).rejects.toThrow("nao-existe");
  });

  it("markChatSeen normaliza chatId e chama sendSeen", async () => {
    await manager.startSession("inst-1", "https://hook.example.com");
    await manager.markChatSeen("inst-1", "5511999991111");
    expect(client._chatsSeen).toContain("5511999991111@c.us");
  });

  it("restoreSessions reinicia instâncias com sessão persistida", async () => {
    registry.entries.set("inst-1", "https://hook.example.com");
    store = makeStoreMock({ exists: true });
    const restoreClient = makeClientMock();
    const factory: ClientFactory = () => restoreClient;
    manager = new SessionManager(factory, () => store, () => registry);

    await manager.restoreSessions();
    await new Promise((r) => setTimeout(r, 10));

    expect(restoreClient._initCalled).toBe(true);
    expect(manager.getStatus("inst-1").status).toBe("INITIALIZING");
  });

  it("restoreSessions remove registry quando sessão não existe no store", async () => {
    registry.entries.set("inst-orphan", "https://hook.example.com");
    store = makeStoreMock({ exists: false });
    manager = new SessionManager(() => client, () => store, () => registry);

    await manager.restoreSessions();

    expect(registry.removeCalls).toContain("inst-orphan");
    expect(registry.entries.has("inst-orphan")).toBe(false);
  });
});
