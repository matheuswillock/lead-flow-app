import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-6" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 10 }).map((_, idx) => (
              <Skeleton key={idx} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

