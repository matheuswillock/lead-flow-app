/**
 * M0.3 — Silencia notificações ao cliente em todos os customers da conta Asaas.
 *
 * Aplica PUT /v3/customers/{id} { notificationDisabled: true } nos 40 customers,
 * priorizando os 26 Member PRO (criados via backoffice_adhesions com billingType=EXTERNAL).
 * Também alimenta corretor_studio_asaas_notification_backfill (M0.4).
 *
 * Uso (sem escrita — apenas simula e imprime o plano):
 *   bun run scripts/billing/silence-asaas-customers.ts
 *
 * Aplicar (requer flag de autorização):
 *   ASAAS_SILENCE_APPLY=1 bun run scripts/billing/silence-asaas-customers.ts --apply
 *
 * --account=legacy  usa ASAAS_LEGACY_API_KEY (ou ASAAS_API_KEY como fallback)
 * --account=primary usa ASAAS_API_KEY
 * --output=<path>   grava relatório JSON no arquivo
 */

import { writeFileSync } from "node:fs";
import { prisma } from "../../app/api/infra/data/prisma";

// ── tipos ──────────────────────────────────────────────────────────────────

type AsaasCustomerPatch = {
  notificationDisabled: boolean;
};

type CustomerResult = {
  customerId: string;
  profileId?: string;
  adhesionId?: string;
  name: string;
  email: string;
  source: "profile" | "adhesion";
  wasSilenced: boolean;
  alreadySilenced: boolean;
  error?: string;
};

type SilenceReport = {
  account: string;
  dryRun: boolean;
  generatedAt: string;
  totalCustomers: number;
  alreadySilenced: number;
  silenced: number;
  failed: number;
  results: CustomerResult[];
};

// ── configuração ───────────────────────────────────────────────────────────

type ScriptArgs = {
  account: string;
  apply: boolean;
  outputArg: string | undefined;
};

function parseArgs(): ScriptArgs {
  const argv = process.argv.slice(2);
  return {
    account: argv.find(a => a.startsWith("--account="))?.split("=")[1] ?? "legacy",
    apply: argv.includes("--apply"),
    outputArg: argv.find(a => a.startsWith("--output="))?.split("=")[1],
  };
}

function resolveApiKey(account: string): string {
  if (account === "primary") {
    const key = process.env.ASAAS_API_KEY;
    if (!key) throw new Error("ASAAS_API_KEY não definida");
    return key;
  }
  const key = process.env.ASAAS_LEGACY_API_KEY ?? process.env.ASAAS_API_KEY;
  if (!key) throw new Error("Nenhuma API key encontrada (ASAAS_LEGACY_API_KEY ou ASAAS_API_KEY)");
  return key;
}

function resolveBaseUrl(): string {
  if (process.env.ASAAS_ENV === "production") {
    return process.env.ASAAS_URL ?? "https://www.asaas.com";
  }
  return process.env.ASAAS_URL_sandbox ?? "https://sandbox.asaas.com";
}

// ── Asaas helpers ──────────────────────────────────────────────────────────

type AsaasCustomerResponse = {
  id: string;
  name: string;
  email: string;
  notificationDisabled: boolean;
};

async function fetchCustomer(
  customerId: string,
  apiKey: string,
  baseUrl: string
): Promise<AsaasCustomerResponse> {
  const res = await fetch(`${baseUrl}/api/v3/customers/${customerId}`, {
    headers: {
      "Content-Type": "application/json",
      "access_token": `$${apiKey}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET customer ${customerId}: ${res.status} ${text}`);
  }

  return res.json() as Promise<AsaasCustomerResponse>;
}

async function silenceCustomer(
  customerId: string,
  apiKey: string,
  baseUrl: string
): Promise<void> {
  const patch: AsaasCustomerPatch = { notificationDisabled: true };
  const res = await fetch(`${baseUrl}/api/v3/customers/${customerId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "access_token": `$${apiKey}`,
    },
    body: JSON.stringify(patch),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PUT customer ${customerId}: ${res.status} ${text}`);
  }
}

// ── leitura do banco ───────────────────────────────────────────────────────

type CustomerCandidate = {
  customerId: string;
  profileId?: string;
  adhesionId?: string;
  source: "profile" | "adhesion";
};

async function loadCustomerCandidates(): Promise<CustomerCandidate[]> {
  const [profileRows, adhesionRows] = await Promise.all([
    prisma.profile.findMany({
      where: { asaasCustomerId: { not: null } },
      select: { id: true, asaasCustomerId: true },
    }),
    prisma.backofficeAdhesion.findMany({
      where: { asaasCustomerId: { not: null } },
      select: { id: true, asaasCustomerId: true },
    }),
  ]);

  const seen = new Set<string>();
  const candidates: CustomerCandidate[] = [];

  // Prioridade 1: adesões (incluem os 26 Member PRO)
  for (const a of adhesionRows) {
    if (!a.asaasCustomerId || seen.has(a.asaasCustomerId)) continue;
    seen.add(a.asaasCustomerId);
    candidates.push({ customerId: a.asaasCustomerId, adhesionId: a.id, source: "adhesion" });
  }

  // Prioridade 2: profiles não cobertos por adesão
  for (const p of profileRows) {
    if (!p.asaasCustomerId || seen.has(p.asaasCustomerId)) continue;
    seen.add(p.asaasCustomerId);
    candidates.push({ customerId: p.asaasCustomerId, profileId: p.id, source: "profile" });
  }

  return candidates;
}

// ── backfill de notificação ────────────────────────────────────────────────

async function upsertNotificationBackfill(customerId: string): Promise<void> {
  await prisma.asaasNotificationBackfill.upsert({
    where: { asaasCustomerId: customerId },
    create: {
      asaasCustomerId: customerId,
      status: "completed",
      completedAt: new Date(),
    },
    update: {
      status: "completed",
      completedAt: new Date(),
    },
  });
}

// ── processamento ──────────────────────────────────────────────────────────

async function processCandidate(
  candidate: CustomerCandidate,
  apply: boolean,
  apiKey: string,
  baseUrl: string
): Promise<CustomerResult> {
  let asaasCustomer: AsaasCustomerResponse;

  try {
    asaasCustomer = await fetchCustomer(candidate.customerId, apiKey, baseUrl);
  } catch (err) {
    return {
      ...candidate,
      name: "?",
      email: "?",
      wasSilenced: false,
      alreadySilenced: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const alreadySilenced = asaasCustomer.notificationDisabled;

  if (alreadySilenced) {
    if (apply) {
      await upsertNotificationBackfill(candidate.customerId).catch(() => {});
    }
    return {
      ...candidate,
      name: asaasCustomer.name,
      email: asaasCustomer.email,
      wasSilenced: false,
      alreadySilenced: true,
    };
  }

  if (!apply) {
    return {
      ...candidate,
      name: asaasCustomer.name,
      email: asaasCustomer.email,
      wasSilenced: false,
      alreadySilenced: false,
    };
  }

  try {
    await silenceCustomer(candidate.customerId, apiKey, baseUrl);
    await upsertNotificationBackfill(candidate.customerId).catch(() => {});
    return {
      ...candidate,
      name: asaasCustomer.name,
      email: asaasCustomer.email,
      wasSilenced: true,
      alreadySilenced: false,
    };
  } catch (err) {
    return {
      ...candidate,
      name: asaasCustomer.name,
      email: asaasCustomer.email,
      wasSilenced: false,
      alreadySilenced: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── saída ──────────────────────────────────────────────────────────────────

function printReport(report: SilenceReport) {
  const prefix = report.dryRun ? "[DRY-RUN]" : "[APPLY]";
  console.info(`\n[silence] ${prefix} ── resultado ──────────────────────────────`);
  console.info(`  total de customers  : ${report.totalCustomers}`);
  console.info(`  já silenciados      : ${report.alreadySilenced}`);
  if (report.dryRun) {
    console.info(`  precisam silenciar  : ${report.totalCustomers - report.alreadySilenced}  ← rodar com --apply`);
  } else {
    console.info(`  silenciados agora   : ${report.silenced}`);
    console.info(`  falhas              : ${report.failed}`);
  }

  const pending = report.results.filter(r => !r.alreadySilenced && !r.wasSilenced && !r.error);
  const errors = report.results.filter(r => !!r.error);

  if (report.dryRun && pending.length > 0) {
    console.info(`\n  customers que seriam silenciados (${pending.length}):`);
    for (const r of pending) {
      console.info(`    [${r.source}] ${r.customerId}  ${r.name}  <${r.email}>`);
    }
  }

  if (errors.length > 0) {
    console.info(`\n  erros (${errors.length}):`);
    for (const r of errors) {
      console.info(`    ${r.customerId}: ${r.error}`);
    }
  }

  console.info("───────────────────────────────────────────────────────────\n");
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  const { account, apply, outputArg } = parseArgs();

  if (apply && process.env.ASAAS_SILENCE_APPLY !== "1") {
    console.error("[silence] Recusado: --apply exige ASAAS_SILENCE_APPLY=1 (autorização do owner).");
    process.exit(1);
  }

  const apiKey = resolveApiKey(account);
  const baseUrl = resolveBaseUrl();

  console.info(`[silence] conta=${account}  base=${baseUrl}  apply=${apply}`);

  const candidates = await loadCustomerCandidates();
  console.info(`[silence] ${candidates.length} customers carregados do banco`);

  const results: CustomerResult[] = [];
  for (const candidate of candidates) {
    const result = await processCandidate(candidate, apply, apiKey, baseUrl);
    results.push(result);
    const icon = result.error ? "❌" : result.alreadySilenced ? "✅" : result.wasSilenced ? "🔇" : "⬜";
    console.info(`  ${icon} ${result.customerId}  ${result.name ?? ""}  [${result.source}]`);
  }

  const report: SilenceReport = {
    account,
    dryRun: !apply,
    generatedAt: new Date().toISOString(),
    totalCustomers: results.length,
    alreadySilenced: results.filter(r => r.alreadySilenced).length,
    silenced: results.filter(r => r.wasSilenced).length,
    failed: results.filter(r => !!r.error).length,
    results,
  };

  const json = JSON.stringify(report, null, 2);

  if (outputArg) {
    writeFileSync(outputArg, json, "utf-8");
    console.info(`[silence] relatório gravado em ${outputArg}`);
  } else {
    process.stdout.write(json + "\n");
  }

  printReport(report);
}

main()
  .catch(err => {
    console.error("[silence] erro fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
