import { Card, CardContent } from "@/components/ui/card"

export default function BackofficeCalendarLoading() {
  return (
    <main className="p-4">
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Carregando...</CardContent>
      </Card>
    </main>
  )
}
