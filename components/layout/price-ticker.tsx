'use client'

const COMMODITIES = [
  { name: 'Cacao', price: 1250, unit: 'kg', chg: +2.3 },
  { name: 'Cafe Robusta', price: 890, unit: 'kg', chg: -0.8 },
  { name: 'Cajou', price: 1100, unit: 'kg', chg: +1.1 },
  { name: 'Riz local', price: 600, unit: 'kg', chg: 0.0 },
  { name: 'Mangue', price: 350, unit: 'kg', chg: +4.2 },
  { name: 'Huile de Palme', price: 750, unit: 'L', chg: -1.5 },
  { name: 'Mais', price: 280, unit: 'kg', chg: +0.5 },
  { name: 'Banane Plantain', price: 220, unit: 'kg', chg: +0.8 },
  { name: 'Igname', price: 400, unit: 'kg', chg: -0.3 },
  { name: 'Tomate', price: 500, unit: 'kg', chg: +3.1 },
]

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(n) }

export function PriceTicker() {
  const items = [...COMMODITIES, ...COMMODITIES]
  return (
    <div className="bg-[#1c1917] border-b border-[#292524] h-8 flex items-center overflow-hidden">
      <span className="shrink-0 h-full bg-[#16a34a] text-white text-[10px] font-black
        tracking-widest uppercase px-3 flex items-center">
        GWA PRIX
      </span>
      <div className="overflow-hidden flex-1">
        <div className="gwa-ticker inline-flex gap-10 pl-6">
          {items.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 shrink-0 text-xs">
              <span className="text-[#d6d3d1] font-medium">{c.name}</span>
              <span className="text-[#f59e0b] font-bold tabular-nums">{fmt(c.price)} FCFA/{c.unit}</span>
              <span className={`font-bold text-[11px] ${
                c.chg > 0 ? 'text-green-400' : c.chg < 0 ? 'text-red-400' : 'text-[#78716c]'
              }`}>
                {c.chg > 0 ? `+${c.chg}%` : c.chg < 0 ? `${c.chg}%` : '0%'}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
