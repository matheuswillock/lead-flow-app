export default function LoadingResourceDetailPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-5xl px-6 sm:px-8 lg:px-10 py-16 md:py-20">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-10 w-full max-w-3xl animate-pulse rounded bg-muted" />
        <div className="mt-4 h-5 w-full max-w-2xl animate-pulse rounded bg-muted" />
        <div className="mt-12 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-5 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </section>
    </main>
  )
}
