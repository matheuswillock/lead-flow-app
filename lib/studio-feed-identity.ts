import type { ActivityType, Prisma } from "@prisma/client";

export const STUDIO_FEED_IDENTITY = {
  displayAuthor: "Corretor Studio",
  authorAvatarUrl: "/corretor-studio-icon.svg",
} as const;

export const STUDIO_AUTHOR_SOURCE = "studio" as const;

export type StudioFeedIdentityPayload = {
  authorSource: typeof STUDIO_AUTHOR_SOURCE;
  displayAuthor: typeof STUDIO_FEED_IDENTITY.displayAuthor;
  authorAvatarUrl: typeof STUDIO_FEED_IDENTITY.authorAvatarUrl;
};

export function isStudioAuthoredPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  return (
    record.authorSource === STUDIO_AUTHOR_SOURCE ||
    record.displayAuthor === STUDIO_FEED_IDENTITY.displayAuthor
  );
}

export function buildStudioActivityPayload(
  payload?: Prisma.InputJsonValue | Record<string, unknown> | null
): Prisma.InputJsonObject {
  return {
    authorSource: STUDIO_AUTHOR_SOURCE,
    ...STUDIO_FEED_IDENTITY,
    ...(payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}),
  };
}

export function buildStudioActivityData(input: {
  type: ActivityType;
  body: string;
  payload?: Prisma.InputJsonValue | Record<string, unknown> | null;
}): {
  type: ActivityType;
  body: string;
  createdBy: null;
  payload: Prisma.InputJsonObject;
} {
  return {
    type: input.type,
    body: input.body,
    createdBy: null,
    payload: buildStudioActivityPayload(input.payload),
  };
}

export const STUDIO_ACTIVITY_AUTHOR = {
  id: "corretor-studio",
  fullName: STUDIO_FEED_IDENTITY.displayAuthor,
  email: "",
  avatarUrl: STUDIO_FEED_IDENTITY.authorAvatarUrl,
} as const;
