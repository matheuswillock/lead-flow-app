export default function LoadingRecursosPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 py-16 md:py-20">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-5 w-full max-w-3xl animate-pulse rounded bg-muted" />
        <div className="mt-2 h-5 w-full max-w-2xl animate-pulse rounded bg-muted" />
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-2xl border border-border bg-muted/30" />
          ))}
        </div>
      </section>
    </main>
  )
}
