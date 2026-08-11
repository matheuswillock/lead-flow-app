export function removeProfileFromSegmentList<T extends { id: string }>(
  items: T[],
  profileId: string
): { items: T[]; removed: boolean } {
  if (!items.some((item) => item.id === profileId)) {
    return { items, removed: false }
  }
  return {
    items: items.filter((item) => item.id !== profileId),
    removed: true,
  }
}
