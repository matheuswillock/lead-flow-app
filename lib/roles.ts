export type AppRole = "master" | "manager" | "backoffice" | "operator" | string;

export function normalizeRole(role?: string | null): string {
  return (role || "").trim().toLowerCase();
}

export function isManagerLikeRole(role?: string | null): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "manager" || normalizedRole === "backoffice";
}
