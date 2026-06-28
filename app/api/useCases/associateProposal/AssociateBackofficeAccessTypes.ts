import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";

export type AssociateBackofficeAccess = TeamAccess & {
  sponsorProfileId: string;
};

export type AssociateBackofficeAccessResult =
  | { access: AssociateBackofficeAccess; error?: never; status?: never }
  | { access?: never; error: import("@/lib/output").Output; status: number };
