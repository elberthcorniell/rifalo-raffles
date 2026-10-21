export default function ExploreRaffleLoading() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      <div className="mb-6 h-9 w-40 animate-pulse rounded-md bg-muted" />
      <div className="space-y-8">
        <div className="h-72 w-full animate-pulse rounded-2xl bg-muted md:h-96" />
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-64 w-full animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    </main>
  )
}
