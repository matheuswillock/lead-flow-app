import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function BackofficeAccountLoading() {
  return (
    <main className="flex min-h-screen justify-center px-4 py-10">
      <Card className="w-full max-w-3xl">
        <CardHeader className="gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </main>
  )
}
