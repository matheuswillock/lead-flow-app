import { Router } from "express";
import { authMiddleware } from "../auth.middleware.js";
import { sessionManager } from "./SessionManager.js";

export const sessionRouter = Router();

sessionRouter.post("/session/start/:instance", authMiddleware, async (req, res) => {
  const { instance } = req.params;
  const { webhookUrl } = req.body as { webhookUrl?: string };
  if (!webhookUrl) {
    res.status(400).json({ error: "webhookUrl required" });
    return;
  }
  await sessionManager.startSession(instance, webhookUrl);
  res.json({ status: "starting", instance });
});

sessionRouter.get("/session/status/:instance", authMiddleware, (req, res) => {
  const state = sessionManager.getStatus(req.params.instance);
  res.json(state);
});

sessionRouter.delete("/session/delete/:instance", authMiddleware, async (req, res) => {
  await sessionManager.deleteSession(req.params.instance);
  res.json({ deleted: true });
});
