/** Squelette de la Boutique : même grille que les vraies cartes (pas de saut de mise en page). */
export default function MarketplaceLoading() {
  return (
    <div className="min-h-screen bg-[#FFF6E5]" aria-busy="true" aria-label="Chargement de la boutique">
      <div className="sticky top-0 z-40 bg-white/95 border-b border-[#E5E7EB]">
        <div className="gwa-shell-wide flex items-center gap-3 p-3 md:px-5">
          <div className="h-6 w-28 rounded bg-muted gwa-skeleton" />
        </div>
        <div className="gwa-shell-wide flex gap-2 px-3 md:px-5 pb-2">
          <div className="h-9 flex-1 rounded-xl bg-muted gwa-skeleton" />
          <div className="h-9 w-9 rounded-xl bg-muted gwa-skeleton" />
        </div>
      </div>
      <main className="gwa-shell-wide p-4 sm:p-5 md:px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="overflow-hidden" data-testid="shop-skeleton">
              <div className="bg-muted gwa-skeleton rounded-2xl aspect-[4/5]" />
              <div className="pt-2 space-y-1">
                <div className="h-3 bg-muted rounded gwa-skeleton" />
                <div className="h-3 bg-muted rounded w-2/3 gwa-skeleton" />
                <div className="h-9 mt-2 bg-muted rounded-full gwa-skeleton" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
