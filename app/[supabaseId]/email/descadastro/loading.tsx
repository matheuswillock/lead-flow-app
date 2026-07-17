import { Skeleton } from "@/components/ui/skeleton"

export default function EmailDescadastroLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--surface-0)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="h-[420px] w-full rounded-xl" />
      </div>
    </div>
  )
}
