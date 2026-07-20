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
const ACTIVE_BETHANIA_WORKFLOWS = new Set([
  "bethania-router",
  "bethania-push-outbound",
  "bethania-error-notifier",
]);
const STUB_BETHANIA_WORKFLOWS = new Set([
  "bethania-verification-channel",
  "bethania-verification-web",
  "bethania-menu-main",
  "bethania-list-leads",
  "bethania-agenda-today",
  "bethania-list-tasks",
  "bethania-add-note-confirm",
]);
const REQUIRED_N8N_ENV = [
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
];
const REQUIRED_EVO_ENV = ["AUTHENTICATION_API_KEY"];

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

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
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

async function listWorkflows() {
  try {
    const { stdout } = await execFileAsync("docker", ["exec", "n8n", "n8n", "list:workflow"], {
      maxBuffer: 2 * 1024 * 1024,
    });
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [id, name, activeRaw] = line.split("|").map((part) => part?.trim() || "");
        const activeText = String(activeRaw || "").toLowerCase();
        const active =
          activeText === "true" ||
          activeText === "active" ||
          activeText === "activated" ||
          activeText === "yes"
            ? true
            : activeText === "false" ||
                activeText === "inactive" ||
                activeText === "deactivated" ||
                activeText === "no"
              ? false
              : null;
        return { id: id || "", name: name || line, active };
      });
  } catch {
    return [];
  }
}

function isConfiguredSecret(value) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  if (text.includes("...") || text.includes("XXXXXXXX") || text.includes("SUBSTITUA_")) return false;
  return true;
}

async function readEnvFromDeploy(filename) {
  try {
    return parseEnvFile(await fs.readFile(path.join(DEPLOY_DIR, filename), "utf8"));
  } catch {
    return {};
  }
}

function buildBethaniaProductionCheck({ containers, workflows, n8nEnv, evoEnv }) {
  const workflowByName = new Map(workflows.map((workflow) => [workflow.name, workflow]));
  const env = {
    n8n: REQUIRED_N8N_ENV.map((key) => ({
      key,
      configured: isConfiguredSecret(n8nEnv[key]),
    })),
    evolution: REQUIRED_EVO_ENV.map((key) => ({
      key,
      configured: isConfiguredSecret(evoEnv[key]),
    })),
  };
  const workflowState = [
    ...Array.from(ACTIVE_BETHANIA_WORKFLOWS).map((name) => {
      const workflow = workflowByName.get(name);
      return {
        name,
        expected: "active",
        actual: workflow?.active ?? "missing",
        ok: workflow?.active === true,
      };
    }),
    ...Array.from(STUB_BETHANIA_WORKFLOWS).map((name) => {
      const workflow = workflowByName.get(name);
      return {
        name,
        expected: "inactive",
        actual: workflow?.active ?? "missing",
        ok: workflow?.active === false,
      };
    }),
  ];
  const n8nContainer = containers.find((container) => container.name === "n8n");
  const imagePinned = Boolean(n8nContainer?.image?.includes("n8nio/n8n:2.28.5"));
  const envOk =
    env.n8n.every((item) => item.configured) &&
    env.evolution.every((item) => item.configured);
  const workflowsOk = workflowState.every((item) => item.ok);

  return {
    ok: envOk && workflowsOk && imagePinned,
    env,
    workflows: workflowState,
    containers: {
      n8nImage: n8nContainer?.image ?? null,
      imagePinned,
    },
    productionEvidenceRequired: [
      "QR da instância bethania escaneado e status connected no backoffice/Evolution",
      "Webhook Evolution da instância bethania apontando para http://n8n:5678/webhook/bethania-inbound",
      "Teste Account -> Gerar código -> VINCULAR -> confirmação WhatsApp executado em produção",
      "Falha forçada em workflow ativo gerando Slack e outbox failed",
      "Overview do n8n sem falhas sistêmicas no caminho feliz por 24h após deploy",
      "Templates HSM bethania_meeting_reminder e bethania_auth_code aprovados no WhatsApp Manager",
    ],
  };
}

async function handleHealth(_req, res) {
  const containers = await listContainers();
  const workflows = await listWorkflows();
  const n8nEnv = await readEnvFromDeploy(".env.n8n");
  const evoEnv = await readEnvFromDeploy(".env.evolution");
  let hostVersion = null;
  try {
    hostVersion = (await fs.readFile(HOST_VERSION_FILE, "utf8")).trim();
  } catch {
    hostVersion = null;
  }
  const bethaniaProductionCheck = buildBethaniaProductionCheck({
    containers,
    workflows,
    n8nEnv,
    evoEnv,
  });
  return json(res, 200, { ok: true, containers, workflows, hostVersion, bethaniaProductionCheck });
}

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

async function handleRestart(body, res) {
  const payload = JSON.parse(body || "{}");
  const service = payload.service || "n8n";
  if (service === "all") {
    const result = await compose("restart");
    return json(res, 200, { ok: true, result });
  }
  const map = { n8n: "n8n", api: "api" };
  const target = map[service];
  if (!target) return json(res, 400, { ok: false, error: "service inválido" });
  const result = await compose("restart", target);
  return json(res, 200, { ok: true, result });
}

async function handleImportWorkflows(_body, res) {
  const workflowsDir = path.join(DEPLOY_DIR, "n8n", "workflows");
  const files = (await fs.readdir(workflowsDir)).filter((f) => f.endsWith(".json"));
  const imported = [];
  await execFileAsync("docker", ["exec", "n8n", "mkdir", "-p", "/tmp/lead-flow-n8n-workflows"]);
  for (const file of files) {
    const local = path.join(workflowsDir, file);
    await execFileAsync("docker", [
      "cp",
      local,
      `n8n:/tmp/lead-flow-n8n-workflows/${file}`,
    ]);
    await execFileAsync("docker", [
      "exec",
      "n8n",
      "n8n",
      "import:workflow",
      `--input=/tmp/lead-flow-n8n-workflows/${file}`,
    ]);
    imported.push(file);
  }

  // activate core workflows
  const { stdout } = await execFileAsync("docker", ["exec", "n8n", "n8n", "list:workflow"]);
  const activeNames = new Set([
    "bethania-router",
    "bethania-push-outbound",
    "bethania-error-notifier",
  ]);
  const stubNames = new Set([
    "bethania-verification-channel",
    "bethania-verification-web",
    "bethania-menu-main",
    "bethania-list-leads",
    "bethania-agenda-today",
    "bethania-list-tasks",
    "bethania-add-note-confirm",
  ]);
  for (const line of stdout.trim().split("\n")) {
    if (!line.includes("|")) continue;
    const [id, name] = line.split("|").map((s) => s.trim());
    if (activeNames.has(name)) {
      try {
        await execFileAsync("docker", ["exec", "n8n", "n8n", "publish:workflow", `--id=${id}`]);
      } catch {
        // best effort
      }
      try {
        await execFileAsync("docker", [
          "exec",
          "n8n",
          "n8n",
          "update:workflow",
          `--id=${id}`,
          "--active=true",
        ]);
      } catch {
        // n8n 2.x deprecation — best effort
      }
    }
    if (stubNames.has(name)) {
      try {
        await execFileAsync("docker", [
          "exec",
          "n8n",
          "n8n",
          "update:workflow",
          `--id=${id}`,
          "--active=false",
        ]);
      } catch {
        // n8n 2.x deprecation — best effort
      }
    }
  }
  await compose("restart", "n8n");
  return json(res, 200, { ok: true, imported });
}

async function handleLogs(req, res) {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const serviceRaw = (url.searchParams.get("service") || "n8n").trim();
  const serviceMap = { n8n: "n8n", api: "api" };
  const service = serviceMap[serviceRaw];
  if (!service) {
    return json(res, 400, { ok: false, error: "service deve ser n8n ou api" });
  }

  let tail = Number(url.searchParams.get("tail") || "200");
  if (!Number.isFinite(tail) || tail < 1) tail = 200;
  if (tail > 1000) tail = 1000;

  const { stdout, stderr } = await compose("logs", "--no-color", `--tail=${tail}`, service);
  const text = [stdout, stderr].filter(Boolean).join("\n");
  const lines = text ? text.split("\n") : [];

  return json(res, 200, {
    ok: true,
    service: serviceRaw === "api" ? "api" : "n8n",
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
  for (const rel of ["docker-compose.vps.yml", "n8n", "studio-bot-ops"]) {
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
  const pull = await compose("pull");
  const up = await compose("up", "-d");
  await fs.rm(tmpDir, { recursive: true, force: true });
  return json(res, 200, { ok: true, version, backupDir, pull, up });
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
    if (req.method === "POST" && url.pathname === "/v1/workflows/import") {
      return await handleImportWorkflows(body, res);
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
