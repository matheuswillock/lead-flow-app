import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  // O shell do produto já é o <main>: um segundo landmark aninhado confunde leitores de tela.
  return <div className="container mx-auto p-8"><Skeleton className="h-64 w-full" /></div>
}
