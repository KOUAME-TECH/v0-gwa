"use client"

import {
  API_ROUTES,
  MISSING_APIS,
  PAGE_ROUTES,
  type RouteStatus,
} from "@/lib/routes/inventory"
import Link from "next/link"

const STATUS_LABEL: Record<RouteStatus, string> = {
  complete: "Complet",
  partial: "Incomplet",
  redirect: "Redirect",
  missing: "Manquant",
}

const STATUS_CLASS: Record<RouteStatus, string> = {
  complete: "bg-emerald-100 text-emerald-900",
  partial: "bg-amber-100 text-amber-950",
  redirect: "bg-slate-100 text-slate-700",
  missing: "bg-red-100 text-red-900",
}

function StatusBadge({ status }: { status: RouteStatus }) {
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function RouteTable({
  title,
  rows,
}: {
  title: string
  rows: { path: string; status: RouteStatus; note?: string }[]
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-[#1A1A1A]">{title}</h2>
      <ul className="divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-white">
        {rows.map((r) => (
          <li key={r.path} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <code className="text-sm text-[#1A1A1A]">{r.path}</code>
              {r.note ? (
                <p className="mt-0.5 text-xs text-[#6B7280]">{r.note}</p>
              ) : null}
            </div>
            <StatusBadge status={r.status} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function DevRoutesPage() {
  const incomplete = PAGE_ROUTES.filter(
    (r) => r.status === "partial" || r.status === "missing",
  )

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
          Audit technique
        </p>
        <h1 className="text-2xl font-semibold text-[#1A1A1A]">
          État des routes GWA
        </h1>
        <p className="text-sm text-[#6B7280]">
          {incomplete.length} pages incomplètes · {API_ROUTES.length} APIs
          présentes · {MISSING_APIS.length} APIs manquantes (F2–F5)
        </p>
        <Link href="/" className="text-sm text-[#2F7D32] underline">
          Retour accueil
        </Link>
      </header>

      <RouteTable title="Pages incomplètes (à finaliser)" rows={incomplete} />
      <RouteTable title="Toutes les pages" rows={PAGE_ROUTES} />
      <RouteTable title="APIs présentes" rows={API_ROUTES} />
      <RouteTable title="APIs manquantes" rows={MISSING_APIS} />
    </div>
  )
}
