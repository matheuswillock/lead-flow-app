import { Skeleton } from "@/components/ui/skeleton"

export default function EmailConfiguracoesLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--surface-0)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
        <Skeleton className="h-48 w-full rounded-[1.75rem]" />
        <Skeleton className="h-80 w-full rounded-[1.1rem]" />
        <Skeleton className="h-80 w-full rounded-[1.1rem]" />
      </div>
    </div>
  )
}
