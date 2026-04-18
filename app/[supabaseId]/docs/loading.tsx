import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Card className="border-precision-border-soft bg-surface-1 shadow-[var(--precision-shadow-1)]">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-32 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-5 w-full max-w-3xl" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="hidden xl:flex xl:flex-col xl:border-precision-border-soft xl:bg-surface-1 xl:shadow-[var(--precision-shadow-1)]">
          <CardHeader className="gap-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card
              key={index}
              className="border-precision-border-soft bg-surface-1 shadow-[var(--precision-shadow-1)]"
            >
              <CardHeader className="gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-full max-w-lg" />
                <Skeleton className="h-5 w-full max-w-2xl" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
