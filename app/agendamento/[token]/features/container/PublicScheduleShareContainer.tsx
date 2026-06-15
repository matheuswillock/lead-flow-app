"use client";

import { usePublicScheduleShareContext } from "../context/PublicScheduleShareContext";
import { PublicScheduleShareDialog } from "../components/PublicScheduleShareDialog";

export function PublicScheduleShareContainer() {
  const { status, data, error, refresh } = usePublicScheduleShareContext();

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-4 py-10 text-foreground">
      <PublicScheduleShareDialog status={status} data={data} error={error} onRetry={refresh} />
    </div>
  );
}
