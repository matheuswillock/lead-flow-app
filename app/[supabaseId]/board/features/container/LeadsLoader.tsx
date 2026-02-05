import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function LeadsLoader() {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />

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
  )
}
