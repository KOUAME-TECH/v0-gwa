'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'

type Commodity = {
  name: string
  price: number
  unit: string
  chg: number
  source: string
  isRealTime: boolean
}

const fetcher = (url: string) => fetch(url).then(r => r.json())
const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

export function PriceTicker() {
  const { data } = useSWR<{ commodities: Commodity[]; lastUpdate: string; sources: string[] }>(
    '/api/prices',
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false }
  )
  const [showSource, setShowSource] = useState(false)

  const commodities = data?.commodities || []
  const items = [...commodities, ...commodities] // double for seamless scroll

  if (commodities.length === 0) return null

  return (
    <div className="bg-[#1c1917] border-b border-[#292524] h-8 flex items-center overflow-hidden relative">
      <button
        onClick={() => setShowSource(!showSource)}
        className="shrink-0 h-full bg-[#16a34a] text-white text-[10px] font-black
          tracking-widest uppercase px-3 flex items-center z-10 active:bg-[#15803d]"
      >
        GWA PRIX
      </button>

      {showSource && data?.sources && (
        <div className="absolute top-8 left-0 bg-[#292524] text-white text-[10px] p-2 rounded-b-lg z-50 shadow-lg">
          <p className="font-bold mb-1">Sources des prix :</p>
          {data.sources.map(s => <p key={s} className="text-[#a8a29e]">{s}</p>)}
          <p className="text-[#78716c] mt-1">MaJ: {new Date(data.lastUpdate).toLocaleTimeString('fr-FR')}</p>
        </div>
      )}

      <div className="overflow-hidden flex-1">
        <div className="gwa-ticker inline-flex gap-10 pl-6">
          {items.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 shrink-0 text-xs">
              <span className="text-[#d6d3d1] font-medium">{c.name}</span>
              <span className="text-[#f59e0b] font-bold tabular-nums">{fmt(c.price)} F/{c.unit}</span>
              <span className={`font-bold text-[11px] ${
                c.chg > 0 ? 'text-green-400' : c.chg < 0 ? 'text-red-400' : 'text-[#78716c]'
              }`}>
                {c.chg > 0 ? `+${c.chg}%` : c.chg < 0 ? `${c.chg}%` : '--'}
              </span>
              {c.isRealTime && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" title="Prix temps reel GWA" />}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
