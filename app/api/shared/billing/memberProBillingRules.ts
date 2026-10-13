import type {
  MemberProBillingContext,
  MemberProBypassOptions,
} from "@/app/api/shared/billing/memberProBillingTypes";

const MEMBER_PRO_SLUG = "member_pro";
export const MEMBER_PRO_ACCESS_DAYS = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface MemberProAccessWindow {
  accessStartsAt: Date;
  accessExpiresAt: Date;
}

export function resolveMemberProAccessWindow(input: {
  start: Date;
  currentExpiresAt?: Date | null;
}): MemberProAccessWindow {
  const accessExpiresAt = new Date(input.start.getTime() + MEMBER_PRO_ACCESS_DAYS * DAY_MS);
  if (input.currentExpiresAt && input.currentExpiresAt.getTime() > accessExpiresAt.getTime()) {
    return {
      accessStartsAt: input.start,
      accessExpiresAt: input.currentExpiresAt,
    };
  }

  return { accessStartsAt: input.start, accessExpiresAt };
}

export function resolveMemberProBypass(
  context: MemberProBillingContext,
  options?: MemberProBypassOptions
): boolean {
  if (options?.forceCharge === true) {
    return false;
  }
  const hasValidUnlimitedGrant =
    context.slug !== MEMBER_PRO_SLUG || context.isActive;
  return context.isActive || (hasValidUnlimitedGrant && context.hasUnlimitedUsers === true);
}

export function isActiveMemberProAssignment(
  assignment: { slug: string; accessStartsAt?: Date | null; accessExpiresAt: Date | null } | null,
  now: Date = new Date()
): boolean {
  if (!assignment || assignment.slug !== MEMBER_PRO_SLUG) {
    return false;
  }
  if (assignment.accessStartsAt && assignment.accessStartsAt.getTime() > now.getTime()) {
    return false;
  }
  return assignment.accessExpiresAt !== null && assignment.accessExpiresAt.getTime() > now.getTime();
}

export function isBlockingMemberProAssignment(
  assignment: { slug: string; accessStartsAt?: Date | null; accessExpiresAt: Date | null } | null,
  now: Date = new Date()
): boolean {
  return assignment?.slug === MEMBER_PRO_SLUG && !isActiveMemberProAssignment(assignment, now);
}

export function buildMemberProContextFromAssignment(
  assignment: { slug: string; accessStartsAt?: Date | null; accessExpiresAt: Date | null } | null
): MemberProBillingContext {
  const slug = assignment?.slug ?? "common";
  const accessExpiresAt = assignment?.accessExpiresAt ?? null;
  const isActive = isActiveMemberProAssignment(assignment);

  return { slug, isActive, accessExpiresAt };
}

/** Fonte de verdade: flag persistida ou ciclo anual; Member PRO não concede ilimitado. */
export function resolveHasUnlimitedUsers(input: {
  hasUnlimitedUsersFlag?: boolean;
  hasPermanentSubscription?: boolean;
  billingCycle?: string | null;
  memberProSlug?: string | null;
  memberProActive?: boolean;
}): boolean {
  const persistedGrantIsValid =
    input.memberProSlug === MEMBER_PRO_SLUG
      ? input.memberProActive === true && input.hasUnlimitedUsersFlag === true
      : input.hasUnlimitedUsersFlag === true;
  return persistedGrantIsValid || ["annual", "yearly"].includes(input.billingCycle?.toLowerCase() ?? "");
}
