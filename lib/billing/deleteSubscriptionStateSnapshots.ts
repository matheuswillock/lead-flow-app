export type SubscriptionSnapshotStore = {
  subscriptionStateSnapshot: {
    deleteMany: (args: {
      where: { profileId: { in: string[] } };
    }) => Promise<unknown>;
  };
};

export function uniqueProfileIds(profileIds: readonly string[]): string[] {
  return [...new Set(profileIds.filter((id) => id.length > 0))];
}

export async function deleteSubscriptionStateSnapshotsForProfiles(
  db: SubscriptionSnapshotStore,
  profileIds: readonly string[],
): Promise<void> {
  const ids = uniqueProfileIds(profileIds);
  if (ids.length === 0) return;
  await db.subscriptionStateSnapshot.deleteMany({
    where: { profileId: { in: ids } },
  });
}
