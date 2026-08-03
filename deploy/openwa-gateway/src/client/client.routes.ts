import { Router } from "express";
import { authMiddleware } from "../auth.middleware.js";
import { sessionManager } from "../sessions/SessionManager.js";
import type { MediaPayload } from "../types.js";

export const clientRouter = Router();

clientRouter.post("/client/sendMessage/:instance", authMiddleware, async (req, res) => {
  const { instance } = req.params;
  const { to, text } = req.body as { to: string; text: string };
  try {
    const messageId = await sessionManager.sendText(instance, to, text);
    res.json({ messageId });
  } catch (err) {
    console.error(`[client.routes][sendMessage] ${instance}`, err);
    res.status(500).json({ error: "Falha ao enviar mensagem" });
  }
});

clientRouter.post("/client/sendMedia/:instance", authMiddleware, async (req, res) => {
  const { instance } = req.params;
  const body = req.body as MediaPayload;
  try {
    const messageId = await sessionManager.sendMedia(instance, body.to, body);
    res.json({ messageId });
  } catch (err) {
    console.error(`[client.routes][sendMedia] ${instance}`, err);
    res.status(500).json({ error: "Falha ao enviar mídia" });
  }
});

clientRouter.post("/client/markChatSeen/:instance", authMiddleware, async (req, res) => {
  const { instance } = req.params;
  const { chatId } = req.body as { chatId: string };
  try {
    await sessionManager.markChatSeen(instance, chatId);
    res.json({ ok: true });
  } catch (err) {
    console.error(`[client.routes][markChatSeen] ${instance}`, err);
    res.status(500).json({ error: "Falha ao marcar como visto" });
  }
});

clientRouter.get("/client/chats/:instance", authMiddleware, async (req, res) => {
  const { instance } = req.params;
  try {
    const chats = await sessionManager.fetchChats(instance);
    res.json({ chats });
  } catch (err) {
    console.error(`[client.routes][chats] ${instance}`, err);
    res.status(500).json({ error: "Falha ao listar conversas" });
  }
});

clientRouter.get("/client/contacts/:instance", authMiddleware, async (req, res) => {
  const { instance } = req.params;
  try {
    const contacts = await sessionManager.fetchContacts(instance);
    res.json({ contacts });
  } catch (err) {
    console.error(`[client.routes][contacts] ${instance}`, err);
    res.status(500).json({ error: "Falha ao listar contatos" });
  }
});

clientRouter.get("/client/messages/:instance", authMiddleware, async (req, res) => {
  const { instance } = req.params;
  const remoteJid = String(req.query.remoteJid ?? "");
  const since = String(req.query.since ?? "");
  if (!remoteJid || !since) {
    res.status(400).json({ error: "remoteJid e since são obrigatórios" });
    return;
  }
  try {
    const messages = await sessionManager.fetchMessagesSince(instance, remoteJid, since);
    res.json({ messages });
  } catch (err) {
    console.error(`[client.routes][messages] ${instance}`, err);
    res.status(500).json({ error: "Falha ao listar mensagens" });
  }
});

clientRouter.get("/client/groupParticipants/:instance", authMiddleware, async (req, res) => {
  const { instance } = req.params;
  const groupJid = String(req.query.groupJid ?? "");
  if (!groupJid) {
    res.status(400).json({ error: "groupJid é obrigatório" });
    return;
  }
  try {
    const participants = await sessionManager.fetchGroupParticipants(instance, groupJid);
    res.json({ participants });
  } catch (err) {
    console.error(`[client.routes][groupParticipants] ${instance}`, err);
    res.status(500).json({ error: "Falha ao listar participantes" });
  }
});
