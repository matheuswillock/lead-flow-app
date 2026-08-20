/**
 * M0.1 — Inventário read-only da conta Asaas.
 *
 * Lê customers, subscriptions, payments pendentes/vencidos e webhooks
 * com paginação completa. Sem nenhuma escrita.
 *
 * Uso:
 *   bun run scripts/billing/asaas-account-inventory.ts
 *   bun run scripts/billing/asaas-account-inventory.ts --account=primary
 *   bun run scripts/billing/asaas-account-inventory.ts --reconcile
 *   bun run scripts/billing/asaas-account-inventory.ts --output=inventory-2026-08-19.json
 *   bun run scripts/billing/asaas-account-inventory.ts --reconcile --output=inventory.json
 *
 * --account=legacy  usa ASAAS_LEGACY_API_KEY (ou ASAAS_API_KEY como fallback enquanto M1.5 não existe)
 * --account=primary usa ASAAS_API_KEY (conta nova após o cutover de env)
 * --reconcile       compara resultado com o nosso banco (5 checagens — ver seção de reconciliação no plano)
 * --output=<path>   grava JSON no arquivo; sem ele, imprime em stdout
 */

import { writeFileSync } from "node:fs";
import { prisma } from "../../app/api/infra/data/prisma";

// ── tipos ──────────────────────────────────────────────────────────────────

type AsaasListResponse<T> = {
  object: string;
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
};

type AsaasCustomer = {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
  externalReference?: string;
  notificationDisabled: boolean;
  deleted: boolean;
};

type AsaasSubscription = {
  id: string;
  customer: string;
  billingType: string;
  status: string;
  value: number;
  nextDueDate: string;
  endDate?: string;
  cycle: string;
  externalReference?: string;
  deleted?: boolean;
};

type AsaasPayment = {
  id: string;
  customer: string;
  subscription?: string;
  billingType: string;
  status: string;
  value: number;
  dueDate: string;
  externalReference?: string;
};

type AsaasWebhook = {
  id: string;
  url: string;
  email?: string;
  enabled: boolean;
  events: string[];
  authToken?: string;
};

type ReconciliationResult = {
  ran: true;
  issues: Array<{ code: string; detail: string; sourceId?: string }>;
  ghostCustomers: string[];
  orphanCustomerPointers: string[];
  orphanSubscriptionPointers: string[];
  subscriptionStatusDivergences: Array<{
    profileId: string;
    ourStatus: string;
    asaasStatus: string;
    asaasSubscriptionId: string;
  }>;
};

type CustomerSummary = {
  total: number;
  withNotificationsEnabled: number;
  withNotificationsDisabled: number;
  withExternalReference: number;
  withoutExternalReference: number;
  data: AsaasCustomer[];
};

type SubscriptionSummary = {
  total: number;
  byStatus: Record<string, number>;
  byCycle: Record<string, number>;
  byBillingType: Record<string, number>;
  creditCardCount: number;
  data: AsaasSubscription[];
};

type PaymentSummary = {
  total: number;
  totalValue: number;
  data: AsaasPayment[];
};

type InventoryReport = {
  account: string;
  generatedAt: string;
  customers: CustomerSummary;
  subscriptions: SubscriptionSummary;
  pendingPayments: PaymentSummary;
  overduePayments: PaymentSummary;
  webhooks: AsaasWebhook[];
  reconciliation?: ReconciliationResult;
};

// ── configuração ───────────────────────────────────────────────────────────

type ScriptArgs = {
  account: string;
  reconcile: boolean;
  outputArg: string | undefined;
};

function parseArgs(): ScriptArgs {
  const argv = process.argv.slice(2);
  return {
    account: argv.find(a => a.startsWith("--account="))?.split("=")[1] ?? "legacy",
    reconcile: argv.includes("--reconcile"),
    outputArg: argv.find(a => a.startsWith("--output="))?.split("=")[1],
  };
}

function resolveApiKey(account: string): string {
  if (account === "primary") {
    const key = process.env.ASAAS_API_KEY;
    if (!key) throw new Error("ASAAS_API_KEY não definida");
    return key;
  }
  // Enquanto M1.5 não existe, ASAAS_LEGACY_API_KEY ainda não é separada — cai em ASAAS_API_KEY.
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

// ── fetch helpers ──────────────────────────────────────────────────────────

async function asaasFetchPage<T>(
  path: string,
  apiKey: string,
  baseUrl: string,
  offset: number,
  limit = 100
): Promise<AsaasListResponse<T>> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${baseUrl}/api/v3${path}${separator}limit=${limit}&offset=${offset}`;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "access_token": `$${apiKey}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Asaas API ${res.status} em ${path}: ${text}`);
  }

  return res.json() as Promise<AsaasListResponse<T>>;
}

async function fetchAllPages<T>(path: string, apiKey: string, baseUrl: string): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const page = await asaasFetchPage<T>(path, apiKey, baseUrl, offset, limit);
    results.push(...page.data);
    if (!page.hasMore) break;
    offset += limit;
  }

  return results;
}

async function fetchWebhooks(apiKey: string, baseUrl: string): Promise<AsaasWebhook[]> {
  const page = await asaasFetchPage<AsaasWebhook>("/webhooks", apiKey, baseUrl, 0, 100);
  return page.data;
}

// ── sumarização ────────────────────────────────────────────────────────────

function buildCountMap<T>(items: T[], key: keyof T): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of items) {
    const val = String(item[key] ?? "unknown");
    map[val] = (map[val] ?? 0) + 1;
  }
  return map;
}

function summarizeCustomers(customers: AsaasCustomer[]): CustomerSummary {
  return {
    total: customers.length,
    withNotificationsEnabled: customers.filter(c => !c.notificationDisabled).length,
    withNotificationsDisabled: customers.filter(c => c.notificationDisabled).length,
    withExternalReference: customers.filter(c => !!c.externalReference).length,
    withoutExternalReference: customers.filter(c => !c.externalReference).length,
    data: customers,
  };
}

function summarizeSubscriptions(subs: AsaasSubscription[]): SubscriptionSummary {
  const byBillingType = buildCountMap(subs, "billingType");
  return {
    total: subs.length,
    byStatus: buildCountMap(subs, "status"),
    byCycle: buildCountMap(subs, "cycle"),
    byBillingType,
    creditCardCount: byBillingType["CREDIT_CARD"] ?? 0,
    data: subs,
  };
}

function summarizePayments(payments: AsaasPayment[]): PaymentSummary {
  const totalValue = payments.reduce((sum, p) => sum + p.value, 0);
  return {
    total: payments.length,
    totalValue: Math.round(totalValue * 100) / 100,
    data: payments,
  };
}

// ── reconciliação banco × Asaas ────────────────────────────────────────────

async function reconcileWithDb(
  customers: AsaasCustomer[],
  subscriptions: AsaasSubscription[]
): Promise<ReconciliationResult> {
  const asaasCustomerIds = new Set(customers.map(c => c.id));
  const asaasSubscriptionMap = new Map(subscriptions.map(s => [s.id, s]));

  const [profileRows, adhesionRows, subscriptionRows] = await Promise.all([
    prisma.profile.findMany({
      where: { asaasCustomerId: { not: null } },
      select: { id: true, asaasCustomerId: true },
    }),
    prisma.backofficeAdhesion.findMany({
      where: { asaasCustomerId: { not: null } },
      select: { id: true, asaasCustomerId: true },
    }),
    prisma.profileSubscription.findMany({
      where: { asaasSubscriptionId: { not: null } },
      select: { id: true, profileId: true, asaasSubscriptionId: true, subscriptionStatus: true },
    }),
  ]);

  const knownCustomerIds = new Set([
    ...profileRows.map(p => p.asaasCustomerId!),
    ...adhesionRows.map(a => a.asaasCustomerId!),
  ]);

  const ghostCustomers = [...asaasCustomerIds].filter(id => !knownCustomerIds.has(id));

  const orphanCustomerPointers = [
    ...new Set([
      ...profileRows.filter(p => !asaasCustomerIds.has(p.asaasCustomerId!)).map(p => p.asaasCustomerId!),
      ...adhesionRows.filter(a => !asaasCustomerIds.has(a.asaasCustomerId!)).map(a => a.asaasCustomerId!),
    ]),
  ];

  const orphanSubscriptionPointers = subscriptionRows
    .filter(s => !asaasSubscriptionMap.has(s.asaasSubscriptionId!))
    .map(s => s.asaasSubscriptionId!);

  const subscriptionStatusDivergences = subscriptionRows
    .filter(s => {
      const asaasSub = asaasSubscriptionMap.get(s.asaasSubscriptionId!);
      if (!asaasSub) return false;
      return (s.subscriptionStatus?.toLowerCase() ?? "") !== asaasSub.status.toLowerCase();
    })
    .map(s => ({
      profileId: s.profileId,
      ourStatus: s.subscriptionStatus ?? "null",
      asaasStatus: asaasSubscriptionMap.get(s.asaasSubscriptionId!)!.status,
      asaasSubscriptionId: s.asaasSubscriptionId!,
    }));

  const issues = [
    ...ghostCustomers.map(id => ({
      code: "GHOST_CUSTOMER",
      detail: `Customer ${id} existe no Asaas mas não está no nosso banco`,
      sourceId: id,
    })),
    ...orphanCustomerPointers.map(id => ({
      code: "ORPHAN_CUSTOMER_POINTER",
      detail: `Customer ${id} está no nosso banco mas não existe no Asaas`,
      sourceId: id,
    })),
    ...orphanSubscriptionPointers.map(id => ({
      code: "ORPHAN_SUBSCRIPTION_POINTER",
      detail: `Subscription ${id} está no nosso banco mas não existe no Asaas`,
      sourceId: id,
    })),
    ...subscriptionStatusDivergences.map(d => ({
      code: "STATUS_DIVERGENCE",
      detail: `Sub ${d.asaasSubscriptionId}: banco=${d.ourStatus}, Asaas=${d.asaasStatus}`,
      sourceId: d.asaasSubscriptionId,
    })),
  ];

  return {
    ran: true,
    issues,
    ghostCustomers,
    orphanCustomerPointers,
    orphanSubscriptionPointers,
    subscriptionStatusDivergences,
  };
}

// ── saída ──────────────────────────────────────────────────────────────────

function printSummary(report: InventoryReport) {
  console.info("\n[inventory] ── resumo ──────────────────────────────────────");
  console.info(`  conta               : ${report.account}`);
  console.info(`  gerado em           : ${report.generatedAt}`);
  console.info(`  customers total     : ${report.customers.total}`);
  console.info(`  notificações LIGADAS: ${report.customers.withNotificationsEnabled}  ← silenciar (M0.3)`);
  console.info(`  notificações off    : ${report.customers.withNotificationsDisabled}`);
  console.info(`  sem externalRef     : ${report.customers.withoutExternalReference}  ← anomalia de correlação`);
  console.info(`  assinaturas total   : ${report.subscriptions.total}`);
  console.info(`  assinaturas por status:`);
  for (const [status, count] of Object.entries(report.subscriptions.byStatus)) {
    console.info(`    ${status.padEnd(14)}: ${count}`);
  }
  console.info(`  cartão de crédito   : ${report.subscriptions.creditCardCount}  ← Fase 6 (reautorização)`);
  console.info(`  pagamentos pendentes: ${report.pendingPayments.total} (R$ ${report.pendingPayments.totalValue})`);
  console.info(`  pagamentos vencidos : ${report.overduePayments.total} (R$ ${report.overduePayments.totalValue})`);
  console.info(`  webhooks            : ${report.webhooks.length}`);

  if (report.reconciliation) {
    console.info(`  ── reconciliação ───────────────────────────────────────`);
    console.info(`  issues total        : ${report.reconciliation.issues.length}`);
    console.info(`  ghost customers     : ${report.reconciliation.ghostCustomers.length}  ← estão no Asaas, não no nosso banco`);
    console.info(`  ponteiros órfãos    : ${report.reconciliation.orphanCustomerPointers.length}  ← no banco, não no Asaas`);
    console.info(`  subs órfãs          : ${report.reconciliation.orphanSubscriptionPointers.length}`);
    console.info(`  divergência status  : ${report.reconciliation.subscriptionStatusDivergences.length}`);

    if (report.reconciliation.issues.length > 0) {
      console.info(`\n[inventory] issues encontradas:`);
      for (const issue of report.reconciliation.issues) {
        console.info(`  [${issue.code}] ${issue.detail}`);
      }
    }
  }

  console.info("────────────────────────────────────────────────────────────\n");
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  const { account, reconcile, outputArg } = parseArgs();
  const apiKey = resolveApiKey(account);
  const baseUrl = resolveBaseUrl();

  console.info(`[inventory] iniciando  conta=${account}  base=${baseUrl}  reconcile=${reconcile}`);

  const [customers, subscriptions, pendingPayments, overduePayments, webhooks] = await Promise.all([
    fetchAllPages<AsaasCustomer>("/customers", apiKey, baseUrl),
    fetchAllPages<AsaasSubscription>("/subscriptions", apiKey, baseUrl),
    fetchAllPages<AsaasPayment>("/payments?status=PENDING", apiKey, baseUrl),
    fetchAllPages<AsaasPayment>("/payments?status=OVERDUE", apiKey, baseUrl),
    fetchWebhooks(apiKey, baseUrl),
  ]);

  const report: InventoryReport = {
    account,
    generatedAt: new Date().toISOString(),
    customers: summarizeCustomers(customers),
    subscriptions: summarizeSubscriptions(subscriptions),
    pendingPayments: summarizePayments(pendingPayments),
    overduePayments: summarizePayments(overduePayments),
    webhooks,
  };

  if (reconcile) {
    console.info("[inventory] reconciliando com o banco...");
    report.reconciliation = await reconcileWithDb(customers, subscriptions);
  }

  const json = JSON.stringify(report, null, 2);

  if (outputArg) {
    writeFileSync(outputArg, json, "utf-8");
    console.info(`[inventory] relatório gravado em ${outputArg}`);
  } else {
    process.stdout.write(json + "\n");
  }

  printSummary(report);
}

main()
  .catch(err => {
    console.error("[inventory] erro fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
