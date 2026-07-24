export default function Loading() {
  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-[#FFF8F0] px-3 pb-24 pt-3" aria-busy="true" aria-label="Chargement">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="h-9 w-28 animate-pulse rounded-full bg-[#E8DFD0]" />
        <div className="flex gap-2">
          <div className="h-9 w-9 animate-pulse rounded-full bg-[#E8DFD0]" />
          <div className="h-9 w-9 animate-pulse rounded-full bg-[#E8DFD0]" />
        </div>
      </div>
      <div className="mb-3 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-16 shrink-0 animate-pulse rounded-full bg-[#E8DFD0]" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mb-4 overflow-hidden rounded-2xl bg-white/70 shadow-sm">
          <div className="flex items-center gap-3 p-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-[#E8DFD0]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 animate-pulse rounded bg-[#E8DFD0]" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-[#F0E8DA]" />
            </div>
          </div>
          <div className="aspect-[4/5] w-full animate-pulse bg-[#EDE4D4]" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 animate-pulse rounded bg-[#E8DFD0]" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-[#F0E8DA]" />
          </div>
        </div>
      ))}
    </div>
  )
}
