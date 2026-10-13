import type { ReconciliationCase, ReconciliationReport } from "./reconcileInventory"

export type ReconciliationWorkItemKind =
  | "orphan_customer"
  | "orphan_subscription"
  | "ghost_customer"
  | "status_divergence"
  | "due_after_contract_end"

export type ReconciliationWorkAction =
  | "review"
  | "provision_primary_customer"
  | "ignore_test_record"
  | "reconcile_existing_customer"
  | "retain_until_manual_removal"
  | "remove_ghost_customer"
  | "block_locally"
  | "remote_review"

export type ReconciliationWorkItem = {
  key: string
  kind: ReconciliationWorkItemKind
  identifier: string
  profileId?: string
  email?: string | null
  detail: string
  defaultAction: ReconciliationWorkAction
  allowedActions: readonly ReconciliationWorkAction[]
}

export type ReconciliationDecision = {
  key: string
  action: ReconciliationWorkAction
  reason: string
}

export type ReconciliationPlan = {
  generatedAt: string
  sourceAccount: "legacy"
  items: ReconciliationWorkItem[]
  decisions: ReconciliationDecision[]
  unresolvedKeys: string[]
}

function customerKind(id: string): ReconciliationWorkItemKind {
  return id.startsWith("cus_") ? "orphan_customer" : "orphan_subscription"
}

function buildOrphanItem(issue: ReconciliationCase): ReconciliationWorkItem {
  const kind = customerKind(issue.asaasId ?? "")
  return {
    key: `orfao:${issue.asaasId}`,
    kind,
    identifier: issue.asaasId ?? issue.dbRefId ?? "unknown",
    profileId: issue.profileId ?? issue.dbRefId,
    email: issue.email,
    detail: issue.detail,
    defaultAction: "review",
    allowedActions:
      kind === "orphan_customer"
        ? ["review", "provision_primary_customer", "ignore_test_record"]
        : ["review", "remote_review", "ignore_test_record"],
  }
}

function buildGhostItem(issue: ReconciliationCase): ReconciliationWorkItem {
  return {
    key: `fantasma:${issue.asaasId}`,
    kind: "ghost_customer",
    identifier: issue.asaasId ?? "unknown",
    email: issue.email,
    detail: issue.detail,
    defaultAction: "review",
    allowedActions: ["review", "reconcile_existing_customer", "retain_until_manual_removal", "remove_ghost_customer"],
  }
}

function buildStatusItem(issue: ReconciliationCase): ReconciliationWorkItem {
  return {
    key: `status:${issue.asaasId}`,
    kind: "status_divergence",
    identifier: issue.asaasId ?? "unknown",
    profileId: issue.profileId ?? issue.dbRefId,
    detail: issue.detail,
    defaultAction: "block_locally",
    allowedActions: ["block_locally", "remote_review"],
  }
}

function buildDueAfterEndItem(
  anomaly: ReconciliationReport["dueAfterEnd"][number]
): ReconciliationWorkItem {
  return {
    key: `due-after-end:${anomaly.asaasSubscriptionId}`,
    kind: "due_after_contract_end",
    identifier: anomaly.asaasSubscriptionId,
    profileId: anomaly.profileId,
    detail: `nextDueDate=${anomaly.nextDueDate}; subscriptionEndDate=${anomaly.subscriptionEndDate}`,
    defaultAction: "block_locally",
    allowedActions: ["block_locally", "remote_review"],
  }
}

function buildCaseItem(issue: ReconciliationCase): ReconciliationWorkItem | null {
  if (issue.code === "ORFAO") return buildOrphanItem(issue)
  if (issue.code === "FANTASMA") return buildGhostItem(issue)
  if (issue.code === "DIVERGENCIA_STATUS") return buildStatusItem(issue)
  return null
}

function validateDecision(
  item: ReconciliationWorkItem,
  decision: ReconciliationDecision
): string | null {
  if (!item.allowedActions.includes(decision.action)) {
    return `Ação ${decision.action} não permitida para ${decision.key}`
  }
  if (decision.reason.trim().length < 10) {
    return `Decisão ${decision.key} precisa de justificativa com pelo menos 10 caracteres`
  }
  return null
}

export function buildReconciliationPlan(
  report: ReconciliationReport,
  decisions: readonly ReconciliationDecision[] = [],
  generatedAt: string = new Date().toISOString()
): ReconciliationPlan {
  const caseItems = report.cases
    .filter((issue) => issue.code !== "INTEGRO" && issue.code !== "SEM_BANCO")
    .map(buildCaseItem)
    .filter((item): item is ReconciliationWorkItem => item !== null)
  const dueItems = report.dueAfterEnd.map(buildDueAfterEndItem)
  const items = [...caseItems, ...dueItems]
  const itemByKey = new Map(items.map((item) => [item.key, item]))
  const validDecisions: ReconciliationDecision[] = []

  for (const decision of decisions) {
    const item = itemByKey.get(decision.key)
    if (!item) throw new Error(`Decisão aponta para item inexistente: ${decision.key}`)
    const error = validateDecision(item, decision)
    if (error) throw new Error(error)
    validDecisions.push({ ...decision, reason: decision.reason.trim() })
  }

  const decidedKeys = new Set(validDecisions.map((decision) => decision.key))
  return {
    generatedAt,
    sourceAccount: "legacy",
    items,
    decisions: validDecisions,
    unresolvedKeys: items
      .filter((item) => item.defaultAction === "review" && !decidedKeys.has(item.key))
      .map((item) => item.key),
  }
}
