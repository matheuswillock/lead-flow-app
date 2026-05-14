export default function PmeSimulatorLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <div className="h-8 w-72 animate-pulse rounded-md bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-card" />
      <div className="h-32 animate-pulse rounded-xl bg-card" />
      <div className="h-24 animate-pulse rounded-xl bg-card" />
    </div>
  );
}

