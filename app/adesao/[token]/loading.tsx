import { Skeleton } from "@/components/ui/skeleton"

export default function PublicAdhesionLoading() {
  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-[560px]" />
          <Skeleton className="h-[360px]" />
        </div>
      </div>
    </main>
  )
}
