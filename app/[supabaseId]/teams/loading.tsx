import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="w-full space-y-6 px-6 py-6">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="space-y-2">
            <Skeleton className="h-8 w-60" />
            <Skeleton className="h-4 w-[520px] max-w-full" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-4 w-44" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-9 w-28 rounded-md" />
              </div>
            </div>

            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border/60 p-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-4 w-56" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-28 rounded-md" />
                    <Skeleton className="h-9 w-9 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

