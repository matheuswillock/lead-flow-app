#!/usr/bin/env node
/**
 * studio-bot-ops — agente HTTP autenticado na VPS Bethânia.
 * Escuta 127.0.0.1:9090 (exposto via Caddy em ops.corretorstudio.com).
 */
import http from "node:http";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.OPS_AGENT_PORT || 9090);
const HOST = process.env.OPS_AGENT_HOST || "127.0.0.1";
const TOKEN = (process.env.OPS_AGENT_TOKEN || "").trim();
const DEPLOY_DIR = process.env.OPS_DEPLOY_DIR || "/opt/lead-flow-bot";
const COMPOSE_FILE = process.env.OPS_COMPOSE_FILE || path.join(DEPLOY_DIR, "docker-compose.vps.yml");
const HOST_VERSION_FILE = path.join(DEPLOY_DIR, ".host-version");

const N8N_ALLOW = new Set([
  "LEAD_FLOW_API_BASE_URL",
  "N8N_WEBHOOK_BASE_URL",
  "BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET",
  "EVO_API_BASE_URL",
  "EVO_API_KEY",
  "EVO_BETHANIA_INSTANCE",
  "BACKOFFICE_BETHANIA_WHATSAPP_NUMBER",
  "N8N_BLOCK_ENV_ACCESS_IN_NODE",
  "NODE_FUNCTION_ALLOW_BUILTIN",
  "N8N_RUNNERS_ENABLED",
  "BETHANIA_SLACK_WEBHOOK_URL",
]);

const EVO_ALLOW = new Set(["AUTHENTICATION_API_KEY", "CONFIG_SESSION_PHONE_VERSION"]);

/**
 * Serviços que restaram no docker-compose.vps.yml após a saída de n8n/Evolution.
 * `studio-bot-ops` fixa container_name; `openwa` recebe o nome derivado do projeto compose.
 */
const MANAGED_SERVICES = [
  { service: "openwa", matchesContainer: (name) => name.includes("openwa") },
  { service: "studio-bot-ops", matchesContainer: (name) => name === "studio_bot_ops" },
];
const DEFAULT_SERVICE = "openwa";
/** Este agente é um dos serviços do compose que ele opera. */
const SELF_SERVICE = "studio-bot-ops";

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sign(body, secret) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function verifyAuth(req, body) {
  if (!TOKEN) return false;
  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer !== TOKEN) return false;
  const signature = req.headers["x-studio-bot-signature"];
  if (!signature) return false;
  const expected = sign(body, TOKEN);
  try {
    return timingSafeEqual(Buffer.from(String(signature)), Buffer.from(expected));
  } catch {
    return false;
  }
}

function verifyBearerOnly(req) {
  if (!TOKEN) return false;
  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!bearer) return false;
  try {
    const a = Buffer.from(bearer, "utf8");
    const b = Buffer.from(TOKEN, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function tokenFingerprint() {
  return createHash("sha256").update(TOKEN).digest("hex").slice(0, 12);
}


async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/** Remove aspas dotenv/compose e comentario inline nao-aspasado (# ...). */
function normalizeEnvValue(raw) {
  let text = String(raw ?? "").trim();
  if (!text) return "";

  const quote = text[0];
  if ((quote === '"' || quote === "'") && text.length >= 2 && text[text.length - 1] === quote) {
    return text.slice(1, -1);
  }

  const commentMatch = text.match(/\s+#/);
  if (commentMatch && commentMatch.index !== undefined) {
    text = text.slice(0, commentMatch.index).trimEnd();
  }
  return text;
}

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    out[trimmed.slice(0, eq).trim()] = normalizeEnvValue(trimmed.slice(eq + 1));
  }
  return out;
}

function serializeEnv(env) {
  return (
    Object.entries(env)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n"
  );
}

async function mergeEnvFile(filePath, patch, allow) {
  let current = {};
  try {
    current = parseEnvFile(await fs.readFile(filePath, "utf8"));
  } catch {
    current = {};
  }
  const filtered = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (allow.has(k) && typeof v === "string" && v.trim()) filtered[k] = v.trim();
  }
  const next = { ...current, ...filtered };
  const bak = `${filePath}.bak-${Date.now()}`;
  try {
    await fs.copyFile(filePath, bak);
  } catch {
    // first write
  }
  await fs.writeFile(filePath, serializeEnv(next), "utf8");
  return { bak, keys: Object.keys(filtered) };
}

async function compose(...args) {
  const { stdout, stderr } = await execFileAsync(
    "docker",
    ["compose", "-f", COMPOSE_FILE, ...args],
    { cwd: DEPLOY_DIR, maxBuffer: 10 * 1024 * 1024 }
  );
  return { stdout: stdout?.trim() || "", stderr: stderr?.trim() || "" };
}

async function ensureEnvOpsFile() {
  const envOpsPath = path.join(DEPLOY_DIR, ".env.ops");
  const examplePaths = [
    path.join(DEPLOY_DIR, "deploy/hostinger/.env.ops.example"),
    path.join(DEPLOY_DIR, ".env.ops.example"),
  ];

  try {
    await fs.access(envOpsPath);
    return { created: false, path: envOpsPath, migratedToken: false };
  } catch {
    // missing — provision below
  }

  let template = "";
  for (const examplePath of examplePaths) {
    try {
      template = await fs.readFile(examplePath, "utf8");
      break;
    } catch {
      // try next
    }
  }

  if (!template) {
    template = ["OPS_AGENT_TOKEN=", ""].join("\n");
  }

  if (TOKEN) {
    template = /^OPS_AGENT_TOKEN=/m.test(template)
      ? template.replace(/^OPS_AGENT_TOKEN=.*$/m, `OPS_AGENT_TOKEN=${TOKEN}`)
      : `OPS_AGENT_TOKEN=${TOKEN}\n${template}`;
  }

  await fs.writeFile(envOpsPath, template, { mode: 0o600 });
  return { created: true, path: envOpsPath, migratedToken: Boolean(TOKEN) };
}

async function listContainers() {
  const { stdout } = await execFileAsync(
    "docker",
    ["ps", "--format", "{{.Names}}\t{{.Status}}\t{{.Image}}"],
    { maxBuffer: 2 * 1024 * 1024 }
  );
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name, status, image] = line.split("\t");
      return { name, status, image };
    });
}

/** `docker ps` reporta "Up 3 hours", "Up 2 minutes (healthy)" ou "Up 30 seconds (unhealthy)". */
function isContainerUp(status) {
  if (!status || !status.startsWith("Up")) return false;
  return !status.includes("(unhealthy)") && !status.includes("(starting)");
}

/** Cada serviço do compose da VPS está no ar? Substitui o antigo check de workflows do n8n. */
function buildVpsStackCheck(containers) {
  const services = MANAGED_SERVICES.map(({ service, matchesContainer }) => {
    const container = containers.find((item) => matchesContainer(item.name));
    return {
      service,
      container: container?.name ?? null,
      image: container?.image ?? null,
      status: container?.status ?? null,
      ok: isContainerUp(container?.status),
    };
  });

  return { ok: services.every((item) => item.ok), services };
}

async function handleHealth(_req, res) {
  const containers = await listContainers();
  let hostVersion = null;
  try {
    hostVersion = (await fs.readFile(HOST_VERSION_FILE, "utf8")).trim();
  } catch {
    hostVersion = null;
  }
  return json(res, 200, {
    ok: true,
    containers,
    hostVersion,
    vpsStackCheck: buildVpsStackCheck(containers),
  });
}

/**
 * CONGELADO — não funciona desde a saída de n8n/Evolution da VPS.
 *
 * Escreve `.env.n8n`/`.env.evolution` e recria serviços que não existem mais no
 * docker-compose.vps.yml, então o `compose up` no fim sempre falha. Mantido
 * intacto de propósito: o modelo de env vive em colunas do banco
 * (`BackofficeBotHostSettings.n8nEnvEncrypted` / `evolutionEnvEncrypted`) e
 * reapontá-lo para o `.env.openwa` exige migration + decisão sobre expor a
 * service key do Supabase no painel. Fica para a Spec 02 (Bethânia → OpenWA).
 */
async function handleApplyEnv(body, res) {
  const payload = JSON.parse(body || "{}");
  const n8nPath = path.join(DEPLOY_DIR, ".env.n8n");
  const evoPath = path.join(DEPLOY_DIR, ".env.evolution");
  const n8n = await mergeEnvFile(n8nPath, payload.n8nEnv, N8N_ALLOW);
  const evo = await mergeEnvFile(evoPath, payload.evolutionEnv, EVO_ALLOW);

  const services = Array.isArray(payload.recreateServices) ? payload.recreateServices : ["n8n"];
  const recreateArgs = ["up", "-d", "--force-recreate", ...services];
  const composeResult = await compose(...recreateArgs);

  return json(res, 200, {
    ok: true,
    n8nKeys: n8n.keys,
    evolutionKeys: evo.keys,
    compose: composeResult,
  });
}

function resolveManagedService(raw) {
  return MANAGED_SERVICES.find(({ service }) => service === raw)?.service ?? null;
}

function managedServiceNames() {
  return MANAGED_SERVICES.map(({ service }) => service).join(" ou ");
}

/**
 * Reinicia um alvo que inclui este próprio container.
 *
 * `docker compose restart studio-bot-ops` mata o processo que está atendendo o
 * request. Se esperarmos o comando terminar, o cliente recebe erro de rede e o
 * job vai para `failed` mesmo quando o restart deu certo. Então respondemos
 * antes e só depois disparamos o compose, sem await — este processo não estará
 * vivo para relatar o resultado.
 */
function restartDetached(res, target) {
  json(res, 202, {
    ok: true,
    detached: true,
    target,
    note: "Restart disparado. O agente reinicia junto, então não há resultado do compose para reportar — confirme com Health depois de alguns segundos.",
  });

  res.on("finish", () => {
    const args = target === "all" ? ["restart"] : ["restart", target];
    compose(...args).catch((error) => {
      console.error("[studio-bot-ops][restart:detached]", target, error);
    });
  });
}

/** O agente roda dentro do compose que ele mesmo opera — ver restartDetached. */
function targetIncludesSelf(target) {
  return target === "all" || target === SELF_SERVICE;
}

async function handleRestart(body, res) {
  const payload = JSON.parse(body || "{}");
  const requested = payload.service || DEFAULT_SERVICE;

  if (requested !== "all" && !resolveManagedService(requested)) {
    return json(res, 400, { ok: false, error: `service deve ser ${managedServiceNames()} ou all` });
  }

  if (targetIncludesSelf(requested)) {
    return restartDetached(res, requested);
  }

  const result = await compose("restart", requested);
  return json(res, 200, { ok: true, result });
}

async function handleLogs(req, res) {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const requested = (url.searchParams.get("service") || DEFAULT_SERVICE).trim();
  const service = resolveManagedService(requested);
  if (!service) {
    return json(res, 400, { ok: false, error: `service deve ser ${managedServiceNames()}` });
  }

  let tail = Number(url.searchParams.get("tail") || "200");
  if (!Number.isFinite(tail) || tail < 1) tail = 200;
  if (tail > 1000) tail = 1000;

  const { stdout, stderr } = await compose("logs", "--no-color", `--tail=${tail}`, service);
  const text = [stdout, stderr].filter(Boolean).join("\n");
  const lines = text ? text.split("\n") : [];

  return json(res, 200, {
    ok: true,
    service,
    lines,
    fetchedAt: new Date().toISOString(),
  });
}

async function handleSyncHost(body, res) {
  const payload = JSON.parse(body || "{}");
  const { version, packBase64, packSha256 } = payload;
  if (!version || !packBase64 || !packSha256) {
    return json(res, 400, { ok: false, error: "version/packBase64/packSha256 obrigatórios" });
  }
  const buf = Buffer.from(packBase64, "base64");
  const actual = createHash("sha256").update(buf).digest("hex");
  if (actual !== packSha256.toLowerCase()) {
    return json(res, 400, { ok: false, error: "sha256 mismatch" });
  }

  const backupDir = path.join(DEPLOY_DIR, `.host-backup-${Date.now()}`);
  await fs.mkdir(backupDir, { recursive: true });
  for (const rel of ["docker-compose.vps.yml", "studio-bot-ops"]) {
    const src = path.join(DEPLOY_DIR, rel);
    try {
      await execFileAsync("cp", ["-a", src, path.join(backupDir, path.basename(rel))]);
    } catch {
      // optional
    }
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "host-pack-"));
  const packPath = path.join(tmpDir, "pack.tar.gz");
  await fs.writeFile(packPath, buf);
  await execFileAsync("tar", ["-xzf", packPath, "-C", DEPLOY_DIR]);
  await fs.writeFile(HOST_VERSION_FILE, `${version}\n`, "utf8");
  const envOps = await ensureEnvOpsFile();
  const build = await compose("build", "studio-bot-ops");
  const pull = await compose("pull");
  const up = await compose("up", "-d");
  await fs.rm(tmpDir, { recursive: true, force: true });
  return json(res, 200, { ok: true, version, backupDir, envOps, build, pull, up });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    if (req.method === "GET" && url.pathname === "/healthz") {
      return json(res, 200, { ok: true });
    }
    if (!TOKEN) {
      return json(res, 500, { ok: false, error: "OPS_AGENT_TOKEN não configurado" });
    }

    // Bearer-only: validação de token (sem HMAC) — útil após rotacionar em .env.ops
    if (req.method === "GET" && url.pathname === "/v1/token/verify") {
      if (!verifyBearerOnly(req)) {
        return json(res, 401, { ok: false, error: "unauthorized" });
      }
      return json(res, 200, { ok: true, tokenFingerprint: tokenFingerprint() });
    }

    const body = req.method === "GET" ? "" : await readBody(req);
    if (!verifyAuth(req, body)) {
      return json(res, 401, { ok: false, error: "unauthorized" });
    }

    if (req.method === "GET" && url.pathname === "/v1/health") {
      return await handleHealth(req, res);
    }
    if (req.method === "GET" && url.pathname === "/v1/logs") {
      return await handleLogs(req, res);
    }
    if (req.method === "POST" && url.pathname === "/v1/env/apply") {
      return await handleApplyEnv(body, res);
    }
    if (req.method === "POST" && url.pathname === "/v1/services/restart") {
      return await handleRestart(body, res);
    }
    if (req.method === "POST" && url.pathname === "/v1/host/sync") {
      return await handleSyncHost(body, res);
    }
    return json(res, 404, { ok: false, error: "not found" });
  } catch (error) {
    console.error("[studio-bot-ops]", error);
    return json(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, HOST, () => {
  console.info(`[studio-bot-ops] listening on ${HOST}:${PORT}`);
});
