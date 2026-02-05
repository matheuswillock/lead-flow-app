import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex min-h-0 h-full w-full max-w-full flex-1 flex-col gap-4 overflow-x-hidden p-4">
      <div className="grid w-full min-w-0 max-w-full gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:h-full">
        <Card className="w-full min-h-0 lg:h-full">
          <CardContent className="flex h-full min-h-0 flex-col gap-4 py-4 px-2">
            <Skeleton className="h-[320px] w-full rounded-lg" />
            <div className="flex items-center justify-between px-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-28" />
            </div>
            <div className="no-scrollbar flex max-h-[40dvh] flex-col gap-2 overflow-y-auto px-2 lg:max-h-none lg:min-h-0 lg:flex-1">
              {Array.from({ length: 12 }).map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-full rounded-md" />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="h-full w-full min-h-0">
          <CardContent className="flex h-full min-h-0 w-full flex-col gap-4 p-4">
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>

            <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-28 w-full rounded-md" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

