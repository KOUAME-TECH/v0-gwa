"use client"

import { useState } from "react"
import Link from "next/link"
import { rfqNeedsCoop } from "@/lib/pricing/coop-advantage"

export function RfqVolumeGate({
  volumeRequested,
  soloAvailable,
  unit = "unités",
}: {
  volumeRequested: number
  soloAvailable: number
  unit?: string
}) {
  const blocked = rfqNeedsCoop(volumeRequested, soloAvailable)
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <p className="text-sm text-[#4B5563]">
        Volume demandé : {volumeRequested} {unit}. Ton stock : {soloAvailable} {unit}.
      </p>
      {blocked ? (
        <p className="mt-2 text-sm text-[#111827]">
          Cette demande requiert un volume de {volumeRequested} {unit}. Seules les coopératives peuvent y répondre en
          groupé. Rejoins une coopérative pour participer.
        </p>
      ) : (
        <p className="mt-2 text-sm text-[#1F5C2E]">Ton stock couvre cette demande.</p>
      )}
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          disabled={blocked}
          className={`inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold ${
            blocked ? "bg-[#E5E7EB] text-[#6B7280]" : "bg-[#1F5C2E] text-white"
          }`}
        >
          Répondre
        </button>
        {blocked ? (
          <Link
            href="/cooperatives"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[#1F5C2E] px-4 text-sm font-semibold text-[#1F5C2E]"
          >
            Voir les coopératives
          </Link>
        ) : null}
      </div>
    </div>
  )
}

export function RfqVolumePlayground() {
  const [asked, setAsked] = useState(50)
  const [stock, setStock] = useState(10)
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold text-[#111827]">Offres groupées</h1>
      <p className="text-sm text-[#4B5563]">
        Un producteur seul ne peut répondre que s’il a le volume. Au-delà, la coopérative groupe ses membres.
      </p>
      <label className="block text-sm font-medium" htmlFor="volume-demande">
        Volume demandé
      </label>
      <input
        id="volume-demande"
        inputMode="numeric"
        className="h-11 w-full rounded-xl border border-[#E5E7EB] px-3"
        value={asked}
        onChange={(event) => setAsked(Math.max(0, Math.round(Number(event.target.value) || 0)))}
      />
      <label className="block text-sm font-medium" htmlFor="stock-solo">
        Ton stock
      </label>
      <input
        id="stock-solo"
        inputMode="numeric"
        className="h-11 w-full rounded-xl border border-[#E5E7EB] px-3"
        value={stock}
        onChange={(event) => setStock(Math.max(0, Math.round(Number(event.target.value) || 0)))}
      />
      <RfqVolumeGate volumeRequested={asked} soloAvailable={stock} />
    </section>
  )
}
