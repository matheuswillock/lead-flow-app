import type { AccessEmailTone } from "@/lib/team-member-access/access-history";
import type { ManagerUserTableRow } from "../types";

/** Cores dos selos de acesso e de status, nos tokens semânticos do projeto. */
export const ACCESS_TONE_CLASS: Record<AccessEmailTone, string> = {
  success: "border-semantic-success-border bg-semantic-success-surface text-semantic-success",
  warning: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  neutral: "border-border bg-muted text-muted-foreground",
};

export const ROLE_LABEL: Record<ManagerUserTableRow["role"], string> = {
  manager: "Manager",
  backoffice: "Backoffice",
  operator: "Operador",
};

/** Permissões delegadas ao manager, em texto (tabela e painel). */
export function delegationLabelsOf(user: ManagerUserTableRow): string[] {
  const labels: string[] = [];
  if (user.role === "manager" && user.canCreateAccountUsers) labels.push("Cadastrar usuários");
  if (user.role === "manager" && user.canManageAccountTeams) labels.push("Gerenciar times");
  if ((user.role === "manager" || user.role === "backoffice") && user.canTransferAccountLeads) labels.push("Transferir leads");
  return labels;
}
