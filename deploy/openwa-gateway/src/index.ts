import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { sessionRouter } from "./sessions/session.routes.js";
import { clientRouter } from "./client/client.routes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use(sessionRouter);
app.use(clientRouter);

app.listen(config.port, () => {
  console.info(`[OpenWA Gateway] rodando na porta ${config.port}`);
});

export { app };
