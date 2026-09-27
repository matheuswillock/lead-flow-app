import { Skeleton } from "@/components/ui/skeleton"

export default function EmailDeliverabilityLoading() {
  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6 md:py-10"><Skeleton className="h-16 w-full max-w-xl" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32 w-full" />)}</div><Skeleton className="h-80 w-full" /></div>
}
