import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-2rem)] w-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-6 w-44" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="relative flex-1">
        <div
          className="grid auto-cols-[minmax(18rem,20rem)] grid-flow-col gap-4 overflow-x-auto pb-2 pr-2"
          style={{ scrollSnapType: "x proximity" }}
        >
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card
              key={idx}
              className="col-span-1 flex min-h-[70vh] flex-col rounded-2xl border bg-card p-3 shadow-sm"
              style={{ scrollSnapAlign: "start" }}
            >
              <Skeleton className="h-12 w-full rounded-md" />
              <div className="mt-3 flex flex-1 flex-col gap-2">
                {Array.from({ length: 3 }).map((__, cardIdx) => (
                  <Skeleton key={cardIdx} className="h-28 w-full rounded-xl" />
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

