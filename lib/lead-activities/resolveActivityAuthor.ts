import {
  isStudioAuthoredPayload,
  STUDIO_ACTIVITY_AUTHOR,
  STUDIO_FEED_IDENTITY,
} from "@/lib/studio-feed-identity";

export type ResolvedActivityAuthor = {
  id: string;
  fullName: string | null;
  email: string;
  avatarUrl?: string | null;
};

export type ActivityAuthorTeamMember = {
  profileId: string;
  name?: string | null;
  email?: string | null;
  profileIconUrl?: string | null;
};

export type ActivityAuthorUser = {
  id: string;
  fullName?: string | null;
  email: string;
  profileIconUrl?: string | null;
};

export function resolveStudioActivityAuthor(
  payload?: Record<string, unknown> | null
): ResolvedActivityAuthor {
  const displayAuthor =
    typeof payload?.displayAuthor === "string"
      ? payload.displayAuthor
      : STUDIO_FEED_IDENTITY.displayAuthor;

  return {
    id: STUDIO_ACTIVITY_AUTHOR.id,
    fullName: displayAuthor,
    email: STUDIO_ACTIVITY_AUTHOR.email,
    avatarUrl:
      typeof payload?.authorAvatarUrl === "string"
        ? payload.authorAvatarUrl
        : STUDIO_FEED_IDENTITY.authorAvatarUrl,
  };
}

export function resolveActivityAuthor(
  profileId: string | null | undefined,
  payload: Record<string, unknown> | null | undefined,
  context: {
    teamMembers: ActivityAuthorTeamMember[];
    user?: ActivityAuthorUser | null;
  }
): ResolvedActivityAuthor | null {
  if (!profileId && isStudioAuthoredPayload(payload)) {
    return resolveStudioActivityAuthor(payload);
  }

  const displayAuthor = typeof payload?.displayAuthor === "string" ? payload.displayAuthor : null;
  if (!profileId && displayAuthor) {
    return resolveStudioActivityAuthor(payload);
  }

  if (!profileId) return null;

  const member = context.teamMembers.find((teamMember) => teamMember.profileId === profileId);
  if (member) {
    return {
      id: member.profileId,
      fullName: member.name ?? null,
      email: member.email || "",
      avatarUrl: member.profileIconUrl ?? null,
    };
  }

  if (context.user?.id === profileId) {
    return {
      id: context.user.id,
      fullName: context.user.fullName ?? null,
      email: context.user.email,
      avatarUrl: context.user.profileIconUrl ?? null,
    };
  }

  return null;
}
