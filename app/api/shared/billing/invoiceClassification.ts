export type InvoiceKind = "subscription" | "addon_user" | "addon_team" | "other";
export type InvoiceSource = "asaas" | "pending_action";

export type InvoiceClassification = {
  invoiceKind: InvoiceKind;
  invoiceName: string;
};

const INVOICE_NAMES: Record<InvoiceKind, string> = {
  subscription: "Assinatura",
  addon_user: "Add-on usuário",
  addon_team: "Add-on time",
  other: "Cobrança",
};

export function invoiceNameForKind(kind: InvoiceKind): string {
  return INVOICE_NAMES[kind];
}

export function classifyPendingActionInvoice(actionType: string): InvoiceClassification {
  if (actionType === "add_user" || actionType === "add_member") {
    return { invoiceKind: "addon_user", invoiceName: INVOICE_NAMES.addon_user };
  }
  if (actionType === "create_team") {
    return { invoiceKind: "addon_team", invoiceName: INVOICE_NAMES.addon_team };
  }
  return { invoiceKind: "other", invoiceName: INVOICE_NAMES.other };
}

export function classifyAsaasPaymentInvoice(input: {
  subscription?: string | null;
  externalReference?: string | null;
  description?: string | null;
}): InvoiceClassification {
  const externalReference = (input.externalReference ?? "").toLowerCase();
  const description = (input.description ?? "").toLowerCase();

  if (externalReference.startsWith("pending-action-")) {
    if (
      description.includes("time") ||
      description.includes("team") ||
      description.includes("licença time") ||
      description.includes("licenca time")
    ) {
      return { invoiceKind: "addon_team", invoiceName: INVOICE_NAMES.addon_team };
    }
    return { invoiceKind: "addon_user", invoiceName: INVOICE_NAMES.addon_user };
  }

  if (externalReference.startsWith("platform-purchase-")) {
    return { invoiceKind: "other", invoiceName: INVOICE_NAMES.other };
  }

  if (input.subscription) {
    return { invoiceKind: "subscription", invoiceName: INVOICE_NAMES.subscription };
  }

  if (
    description.includes("assinatura") ||
    description.includes("mensalidade") ||
    description.includes("subscription")
  ) {
    return { invoiceKind: "subscription", invoiceName: INVOICE_NAMES.subscription };
  }

  if (
    description.includes("add-on usuário") ||
    description.includes("add-on usuario") ||
    description.includes("addon usuário") ||
    description.includes("addon usuario") ||
    description.includes("licença usuário") ||
    description.includes("licenca usuario") ||
    description.includes("usuário extra") ||
    description.includes("usuario extra")
  ) {
    return { invoiceKind: "addon_user", invoiceName: INVOICE_NAMES.addon_user };
  }

  if (
    description.includes("add-on time") ||
    description.includes("addon time") ||
    description.includes("licença time") ||
    description.includes("licenca time") ||
    description.includes("time extra")
  ) {
    return { invoiceKind: "addon_team", invoiceName: INVOICE_NAMES.addon_team };
  }

  return { invoiceKind: "other", invoiceName: INVOICE_NAMES.other };
}

export function buildPendingActionInvoiceId(pendingActionId: string): string {
  return `pending-action-${pendingActionId}`;
}

export function parsePendingActionInvoiceId(invoiceId: string): string | null {
  if (!invoiceId.startsWith("pending-action-")) {
    return null;
  }
  const id = invoiceId.slice("pending-action-".length).trim();
  return id.length > 0 ? id : null;
}
