"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Camera, IdCard, CheckCircle2, Upload } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type Status = "idle" | "pending" | "approved" | "rejected" | "more_info_needed"

/**
 * KYC soft : pièce d'identité + selfie → verification_requests.
 * N'bloque jamais la connexion ; badge vérifié après review admin.
 */
export default function VerificationPage() {
  const router = useRouter()
  const idRef = useRef<HTMLInputElement>(null)
  const selfieRef = useRef<HTMLInputElement>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>("idle")
  const [idFile, setIdFile] = useState<File | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [idPreview, setIdPreview] = useState<string | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/auth/login?redirect=/profil/verification")
        return
      }
      setUserId(user.id)

      const { data: existing } = await supabase
        .from("verification_requests")
        .select("status, created_at")
        .eq("user_id", user.id)
        .eq("request_type", "user")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing?.status) setStatus(existing.status as Status)
      setLoading(false)
    })()
  }, [router])

  const onPick = (
    file: File | undefined,
    kind: "id" | "selfie",
  ) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Image requise (JPG ou PNG)")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Fichier trop lourd (max 2 Mo)")
      return
    }
    const url = URL.createObjectURL(file)
    if (kind === "id") {
      setIdFile(file)
      setIdPreview(url)
    } else {
      setSelfieFile(file)
      setSelfiePreview(url)
    }
  }

  const submit = async () => {
    if (!userId || !idFile || !selfieFile) {
      toast.error("Ajoutez la pièce et le selfie")
      return
    }
    setBusy(true)
    try {
      const supabase = createClient()
      const stamp = Date.now()
      const idPath = `${userId}/kyc-id-${stamp}.${idFile.name.split(".").pop() || "jpg"}`
      const selfiePath = `${userId}/kyc-selfie-${stamp}.${selfieFile.name.split(".").pop() || "jpg"}`

      const { error: idUp } = await supabase.storage
        .from("avatars")
        .upload(idPath, idFile, { upsert: true })
      if (idUp) throw idUp

      const { error: selfUp } = await supabase.storage
        .from("avatars")
        .upload(selfiePath, selfieFile, { upsert: true })
      if (selfUp) throw selfUp

      const {
        data: { publicUrl: idUrl },
      } = supabase.storage.from("avatars").getPublicUrl(idPath)
      const {
        data: { publicUrl: selfieUrl },
      } = supabase.storage.from("avatars").getPublicUrl(selfiePath)

      const res = await fetch("/api/auth/verification-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: [
            { type: "id_document", url: idUrl },
            { type: "selfie", url: selfieUrl },
          ],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Échec")

      setStatus("pending")
      toast.success("Demande envoyée — revue sous 24–72 h")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible")
    }
    setBusy(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-5">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-12">
      <header className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] px-4 py-3 flex items-center gap-3">
        <Link href="/profil" className="p-2 -ml-2 active:opacity-60" aria-label="Retour">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Vérification d&apos;identité</h1>
      </header>

      <div className="px-5 pt-6 space-y-6 max-w-lg mx-auto">
        <p className="text-sm text-neutral-600 leading-relaxed">
          Pour le badge vérifié : une pièce d&apos;identité lisible et un selfie
          clair. Vous pouvez utiliser GWA sans ça — c&apos;est optionnel.
        </p>

        {status === "pending" && (
          <div className="rounded-2xl bg-[#FFF6E5] px-4 py-3 text-sm text-[#1F5C2E] flex gap-2 items-start">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            Demande en cours d&apos;examen. Vous serez notifié une fois validée.
          </div>
        )}
        {status === "approved" && (
          <div className="rounded-2xl bg-[#E8F5E9] px-4 py-3 text-sm text-[#1F5C2E] flex gap-2 items-start">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            Identité vérifiée — badge actif sur votre profil.
          </div>
        )}
        {status === "rejected" && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Demande refusée. Vous pouvez renvoyer de nouvelles photos.
          </div>
        )}

        {status !== "approved" && status !== "pending" && (
          <>
            <section className="space-y-3">
              <div className="flex items-center gap-2 font-medium text-[#1F5C2E]">
                <IdCard className="h-4 w-4" />
                Pièce d&apos;identité
              </div>
              <button
                type="button"
                onClick={() => idRef.current?.click()}
                className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-[#C5D4C2] bg-[#F3F7F0] overflow-hidden flex flex-col items-center justify-center gap-2 active:scale-[0.99] transition-transform"
              >
                {idPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={idPreview} alt="Pièce" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-[#2F7D32]" />
                    <span className="text-sm text-neutral-600">CNI, passeport ou permis</span>
                  </>
                )}
              </button>
              <input
                ref={idRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onPick(e.target.files?.[0], "id")}
              />
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 font-medium text-[#1F5C2E]">
                <Camera className="h-4 w-4" />
                Selfie
              </div>
              <button
                type="button"
                onClick={() => selfieRef.current?.click()}
                className="w-full aspect-square max-h-64 rounded-2xl border-2 border-dashed border-[#C5D4C2] bg-[#F3F7F0] overflow-hidden flex flex-col items-center justify-center gap-2 mx-auto active:scale-[0.99] transition-transform"
              >
                {selfiePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selfiePreview} alt="Selfie" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera className="h-8 w-8 text-[#2F7D32]" />
                    <span className="text-sm text-neutral-600">Visage bien visible</span>
                  </>
                )}
              </button>
              <input
                ref={selfieRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => onPick(e.target.files?.[0], "selfie")}
              />
            </section>

            <Button
              className="w-full h-12 rounded-xl bg-[#2F7D32] hover:bg-[#256025]"
              disabled={busy || !idFile || !selfieFile}
              onClick={submit}
            >
              {busy ? "Envoi…" : "Envoyer pour vérification"}
            </Button>
          </>
        )}

        <Link href="/profil/lier" className="block text-center text-sm text-[#2F7D32] underline">
          Lier email / téléphone
        </Link>
      </div>
    </div>
  )
}
