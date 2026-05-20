import { Skeleton } from "@/components/ui/skeleton"

export default function EmailConfiguracoesLoading() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full max-w-xl" />
    </div>
  )
}
