"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Camera, IdCard, CheckCircle2, Upload, SwitchCamera } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { shouldPromptIdentityVerification } from "@/lib/verification/badge"

type Status = "idle" | "pending" | "approved" | "rejected" | "more_info_needed"

/**
 * KYC soft : pièce d'identité + selfie caméra → verification_requests.
 * Utile pour le badge et le SCG — optionnel pour utiliser GWA.
 */
export default function VerificationPage() {
  const router = useRouter()
  const idRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [status, setStatus] = useState<Status>("idle")
  const [idFile, setIdFile] = useState<File | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [idPreview, setIdPreview] = useState<string | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOpen(false)
  }

  useEffect(() => {
    return () => stopCamera()
  }, [])

  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) return
    videoRef.current.srcObject = streamRef.current
    void videoRef.current.play().catch(() => {})
  }, [cameraOpen])

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

      const [{ data: existing }, { data: profile }] = await Promise.all([
        supabase
          .from("verification_requests")
          .select("status, created_at")
          .eq("user_id", user.id)
          .eq("request_type", "user")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("is_verified")
          .eq("id", user.id)
          .maybeSingle(),
      ])

      if (existing?.status) setStatus(existing.status as Status)
      setIsVerified(profile?.is_verified === true)
      setLoading(false)
    })()
  }, [router])

  const onPickId = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Image requise (JPG ou PNG)")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Fichier trop lourd (max 2 Mo)")
      return
    }
    setIdFile(file)
    setIdPreview(URL.createObjectURL(file))
  }

  const startSelfieCamera = async () => {
    try {
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      })
      streamRef.current = stream
      setCameraOpen(true)
    } catch {
      toast.error("Caméra inaccessible. Autorisez l'accès dans le navigateur.")
      // Fallback file input capture
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "image/*"
      input.capture = "user"
      input.onchange = () => {
        const f = input.files?.[0]
        if (!f) return
        if (f.size > 2 * 1024 * 1024) {
          toast.error("Fichier trop lourd (max 2 Mo)")
          return
        }
        setSelfieFile(f)
        setSelfiePreview(URL.createObjectURL(f))
      }
      input.click()
    }
  }

  const captureSelfie = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      toast.error("Caméra pas prête")
      return
    }
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    // Miroir horizontal (selfie naturel)
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Capture impossible")
          return
        }
        if (blob.size > 2 * 1024 * 1024) {
          toast.error("Image trop lourde. Rapprochez-vous un peu.")
          return
        }
        const file = new File([blob], `selfie-${Date.now()}.jpg`, {
          type: "image/jpeg",
        })
        setSelfieFile(file)
        setSelfiePreview(URL.createObjectURL(blob))
        stopCamera()
        toast.success("Selfie capturé")
      },
      "image/jpeg",
      0.9,
    )
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
      const selfiePath = `${userId}/kyc-selfie-${stamp}.jpg`

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
      toast.success("Demande envoyée. Réponse sous 24 à 72 h.")
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

  const prompt = shouldPromptIdentityVerification({
    is_verified: isVerified,
    kyc_status: status === "idle" ? null : status,
  })

  return (
    <div className="min-h-screen bg-white pb-12">
      <header className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] px-4 py-3 flex items-center gap-3">
        <Link href="/profil/edit" className="p-2 -ml-2 active:opacity-60" aria-label="Retour paramètres">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Vérification d&apos;identité</h1>
      </header>

      <div className="px-5 pt-6 space-y-6 max-w-lg mx-auto">
        <p className="text-sm text-neutral-600 leading-relaxed">
          Une pièce d&apos;identité et un selfie pour le badge vérifié. Vous
          pouvez utiliser GWA sans ça.
        </p>

        {status === "pending" && (
          <div className="rounded-2xl bg-[#FFF6E5] px-4 py-3 text-sm text-[#1F5C2E] flex gap-2 items-start">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            Demande en cours d&apos;examen. Vous serez notifié une fois validée.
          </div>
        )}
        {(status === "approved" || isVerified) && (
          <div className="rounded-2xl bg-[#E8F5E9] px-4 py-3 text-sm text-[#1F5C2E] flex gap-2 items-start">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            Identité vérifiée. Badge actif.
          </div>
        )}
        {status === "rejected" && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Demande refusée. Vous pouvez renvoyer de nouvelles photos.
          </div>
        )}

        {prompt && (
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
                onChange={(e) => onPickId(e.target.files?.[0])}
              />
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 font-medium text-[#1F5C2E]">
                <Camera className="h-4 w-4" />
                Selfie (caméra)
              </div>

              {cameraOpen ? (
                <div className="space-y-3">
                  <div className="relative w-full aspect-square max-h-72 rounded-2xl overflow-hidden bg-black mx-auto">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-11 rounded-xl"
                      onClick={stopCamera}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 h-11 rounded-xl bg-[#2F7D32] hover:bg-[#256025]"
                      onClick={captureSelfie}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Capturer
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void startSelfieCamera()}
                  className="w-full aspect-square max-h-64 rounded-2xl border-2 border-dashed border-[#C5D4C2] bg-[#F3F7F0] overflow-hidden flex flex-col items-center justify-center gap-2 mx-auto active:scale-[0.99] transition-transform"
                >
                  {selfiePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selfiePreview} alt="Selfie" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <SwitchCamera className="h-8 w-8 text-[#2F7D32]" />
                      <span className="text-sm text-neutral-600">Ouvrir la caméra selfie</span>
                    </>
                  )}
                </button>
              )}
              {selfiePreview && !cameraOpen && (
                <button
                  type="button"
                  className="text-sm text-[#2F7D32] underline"
                  onClick={() => void startSelfieCamera()}
                >
                  Reprendre le selfie
                </button>
              )}
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

        <Link href="/profil/edit" className="block text-center text-sm text-[#2F7D32] underline">
          Retour aux paramètres
        </Link>
      </div>
    </div>
  )
}
