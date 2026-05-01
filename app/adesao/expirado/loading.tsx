import { Skeleton } from "@/components/ui/skeleton"

export default function ExpiredAdhesionLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Skeleton className="h-64 w-full max-w-md" />
    </main>
  )
}
