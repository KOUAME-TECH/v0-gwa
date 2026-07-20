"use client"

import React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  X,
  Package,
  MessageSquare,
  ImagePlus,
  ChevronRight,
  Loader2,
  Camera,
  Video,
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  compressImage,
  extensionForType,
  validateVideoFile,
  validateAudioFile,
  buildPostMediaPayload,
  resolvePostType,
} from "@/lib/media/compress"
import { filterBetaCategories } from "@/lib/catalog/categories"

type PublishType = "product" | "post" | null

type Category = {
  id: string
  name: string
  slug: string
  category_type: string
}

type ImageFile = {
  file: File
  preview: string
}

type MediaFile = {
  file: File
  url: string
}

export default function PublierPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  const [user, setUser] = useState<{ id: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [publishType, setPublishType] = useState<PublishType>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadLabel, setUploadLabel] = useState("")
  const [categories, setCategories] = useState<Category[]>([])
  const [images, setImages] = useState<ImageFile[]>([])
  const [video, setVideo] = useState<MediaFile | null>(null)
  const [audio, setAudio] = useState<MediaFile | null>(null)
  const [isRecording, setIsRecording] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])

  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    unit: "kg",
    stock_quantity: "",
    category_id: "",
    product_type: "agriculture",
  })

  const [postContent, setPostContent] = useState("")

  useEffect(() => {
    const init = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()
      setUser(currentUser)
      setIsLoading(false)

      const { data } = await supabase
        .from("categories")
        .select("id, name, slug, category_type")
        .eq("category_type", "agriculture")
        .is("parent_id", null)
        .order("name")
      // Défense en profondeur : exclut tout type hors périmètre beta (ex. artisanat)
      setCategories(filterBetaCategories(data || []))
    }
    init()
  }, [supabase])

  // Cleanup des previews au unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.preview))
      if (video) URL.revokeObjectURL(video.url)
      if (audio) URL.revokeObjectURL(audio.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetMedia = () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview))
    if (video) URL.revokeObjectURL(video.url)
    if (audio) URL.revokeObjectURL(audio.url)
    setImages([])
    setVideo(null)
    setAudio(null)
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const maxImages = publishType === "post" ? 4 : 5
    const remaining = maxImages - images.length
    const selected = Array.from(files).slice(0, remaining)

    if (fileInputRef.current) fileInputRef.current.value = ""
    if (selected.length === 0) return

    // Compression client avant ajout (accélère fortement l'upload mobile)
    const compressed = await Promise.all(
      selected.map(async (file) => {
        const out = await compressImage(file)
        return { file: out, preview: URL.createObjectURL(out) }
      }),
    )
    setImages((prev) => [...prev, ...compressed])
  }

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (videoInputRef.current) videoInputRef.current.value = ""
    if (!file) return
    const check = validateVideoFile(file)
    if (!check.ok) {
      toast.error(check.error!)
      return
    }
    if (video) URL.revokeObjectURL(video.url)
    setVideo({ file, url: URL.createObjectURL(file) })
  }

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (audioInputRef.current) audioInputRef.current.value = ""
    if (!file) return
    const check = validateAudioFile(file)
    if (!check.ok) {
      toast.error(check.error!)
      return
    }
    if (audio) URL.revokeObjectURL(audio.url)
    setAudio({ file, url: URL.createObjectURL(file) })
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      // Fallback : ouvrir le sélecteur (enregistreur natif sur mobile)
      audioInputRef.current?.click()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : ""
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      )
      recordedChunksRef.current = []
      recorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) recordedChunksRef.current.push(evt.data)
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm"
        const blob = new Blob(recordedChunksRef.current, { type })
        const ext = extensionForType(type)
        const file = new File([blob], `note-vocale-${Date.now()}.${ext}`, { type })
        if (audio) URL.revokeObjectURL(audio.url)
        setAudio({ file, url: URL.createObjectURL(file) })
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch {
      toast.error("Micro indisponible. Vous pouvez importer un fichier audio.")
      audioInputRef.current?.click()
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const uploadFile = async (bucket: string, file: File): Promise<string> => {
    if (!user) throw new Error("Non authentifié")
    const ext = extensionForType(file.type) || file.name.split(".").pop() || "bin"
    const fileName = `${user.id}/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}.${ext}`
    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { cacheControl: "3600", upsert: false })
    if (error) throw new Error(error.message)
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(fileName)
    return publicUrl
  }

  const uploadAllMedia = async (bucket: string) => {
    const totalSteps = images.length + (video ? 1 : 0) + (audio ? 1 : 0)
    let done = 0
    const bump = () => {
      done += 1
      setUploadProgress(totalSteps ? Math.round((done / totalSteps) * 100) : 100)
    }

    const imageUrls: string[] = []
    for (const img of images) {
      setUploadLabel("Envoi des photos…")
      imageUrls.push(await uploadFile(bucket, img.file))
      bump()
    }

    let videoUrl: string | null = null
    if (video) {
      setUploadLabel("Envoi de la vidéo…")
      videoUrl = await uploadFile(bucket, video.file)
      bump()
    }

    let audioUrl: string | null = null
    if (audio) {
      setUploadLabel("Envoi de la note vocale…")
      audioUrl = await uploadFile(bucket, audio.file)
      bump()
    }

    return { imageUrls, videoUrl, audioUrl }
  }

  const handleSubmitProduct = async () => {
    if (!user) return
    if (!productForm.name || !productForm.price || !productForm.category_id) {
      toast.error("Veuillez remplir tous les champs obligatoires")
      return
    }

    setIsSubmitting(true)
    setUploadProgress(0)

    try {
      const { imageUrls, videoUrl, audioUrl } = await uploadAllMedia("products")
      setUploadLabel("Publication…")

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: productForm.name,
          description: productForm.description,
          price: parseFloat(productForm.price),
          unit: productForm.unit,
          stock_quantity: parseInt(productForm.stock_quantity) || 0,
          category_id: productForm.category_id,
          product_type: productForm.product_type,
          images: imageUrls.length > 0 ? imageUrls : null,
          video_url: videoUrl,
          audio_url: audioUrl,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "Erreur publication")

      toast.success("Produit publié avec succès !")
      router.push("/profil")
    } catch (error: any) {
      console.error("Error:", error)
      toast.error(error.message || "Erreur lors de la publication")
    } finally {
      setIsSubmitting(false)
      setUploadProgress(0)
      setUploadLabel("")
    }
  }

  const handleSubmitPost = async () => {
    if (!user) return
    const hasMedia = images.length > 0 || !!video || !!audio
    // La légende devient optionnelle si un média (dont note vocale) est présent
    if (!postContent.trim() && !hasMedia) {
      toast.error("Ajoutez du texte, une photo ou une note vocale")
      return
    }

    setIsSubmitting(true)
    setUploadProgress(0)

    try {
      const { imageUrls, videoUrl, audioUrl } = await uploadAllMedia("posts")
      setUploadLabel("Publication…")

      const mediaUrls = buildPostMediaPayload(imageUrls, videoUrl)

      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: postContent.trim(),
        media_urls: mediaUrls.length > 0 ? mediaUrls : [],
        video_url: videoUrl,
        audio_url: audioUrl,
        visibility: "public",
        post_type: resolvePostType({
          hasImages: imageUrls.length > 0,
          hasVideo: !!videoUrl,
          hasAudio: !!audioUrl,
        }),
      })

      if (error) throw error

      toast.success("Publication créée !")
      router.push("/")
    } catch (error: any) {
      console.error("Error:", error)
      toast.error(error.message || "Erreur lors de la publication")
    } finally {
      setIsSubmitting(false)
      setUploadProgress(0)
      setUploadLabel("")
    }
  }

  const filteredCategories = categories.filter(
    (cat) => cat.category_type === productForm.product_type,
  )

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-[#FFF6E5] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2F7D32]" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-dvh bg-[#FFF6E5] flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-[#2F7D32]/10 rounded-full flex items-center justify-center mb-6">
          <Camera className="h-10 w-10 text-[#2F7D32]" />
        </div>
        <h2 className="text-xl font-semibold text-[#111827] mb-2 text-center">
          Connectez-vous pour publier
        </h2>
        <p className="text-[#4B5563] text-center mb-6">
          Partagez vos produits et actualités avec la communauté GWA
        </p>
        <Link href="/auth/login?redirect=/publier">
          <Button className="bg-[#2F7D32] hover:bg-[#256025] text-white rounded-full px-8 h-12">
            Se connecter
          </Button>
        </Link>
      </div>
    )
  }

  const HiddenInputs = (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={videoInputRef}
        onChange={handleVideoSelect}
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
      />
      <input
        type="file"
        ref={audioInputRef}
        onChange={handleAudioSelect}
        accept="audio/*"
        capture
        className="hidden"
      />
    </>
  )

  // Bloc de médias enrichis réutilisable (vidéo + note vocale)
  const MediaExtras = (
    <div className="space-y-3">
      {video && (
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video src={video.url} controls className="w-full max-h-64" />
          <button
            onClick={() => {
              URL.revokeObjectURL(video.url)
              setVideo(null)
            }}
            className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center"
            aria-label="Retirer la vidéo"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
      )}

      {audio && (
        <div className="flex items-center gap-3 rounded-xl bg-white border border-[#E5E7EB] p-3">
          <div className="w-9 h-9 rounded-full bg-[#F39A1F]/10 flex items-center justify-center flex-shrink-0">
            <Mic className="h-5 w-5 text-[#F39A1F]" />
          </div>
          <audio src={audio.url} controls className="flex-1 min-w-0 h-9" />
          <button
            onClick={() => {
              URL.revokeObjectURL(audio.url)
              setAudio(null)
            }}
            className="p-2 text-neutral-400 active:text-red-500"
            aria-label="Retirer la note vocale"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )

  // Barre d'outils média (photo, vidéo, note vocale)
  const MediaToolbar = ({ imageMax }: { imageMax: number }) => (
    <div className="flex items-center gap-1">
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={images.length >= imageMax}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[#2F7D32] disabled:opacity-40 active:bg-[#2F7D32]/5"
      >
        <ImagePlus className="h-5 w-5" />
        <span className="text-xs font-medium">
          Photo ({images.length}/{imageMax})
        </span>
      </button>
      <button
        onClick={() => videoInputRef.current?.click()}
        disabled={!!video}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[#2F7D32] disabled:opacity-40 active:bg-[#2F7D32]/5"
      >
        <Video className="h-5 w-5" />
        <span className="text-xs font-medium">Vidéo</span>
      </button>
      {isRecording ? (
        <button
          onClick={stopRecording}
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-red-600 bg-red-50 animate-pulse"
        >
          <Square className="h-5 w-5 fill-current" />
          <span className="text-xs font-medium">Stop</span>
        </button>
      ) : (
        <button
          onClick={startRecording}
          disabled={!!audio}
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[#F39A1F] disabled:opacity-40 active:bg-[#F39A1F]/5"
        >
          <Mic className="h-5 w-5" />
          <span className="text-xs font-medium">Vocal</span>
        </button>
      )}
    </div>
  )

  const ProgressBar = ({ color }: { color: string }) =>
    isSubmitting && uploadProgress > 0 ? (
      <div className="mt-4">
        <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${uploadProgress}%`, backgroundColor: color }}
          />
        </div>
        <p className="text-sm text-[#4B5563] mt-1 text-center">
          {uploadLabel || "Envoi…"} {uploadProgress}%
        </p>
      </div>
    ) : null

  // Sélection du type
  if (!publishType) {
    return (
      <div className="min-h-dvh bg-[#FFF6E5]">
        {HiddenInputs}
        <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB] safe-top">
          <div className="flex items-center h-14 px-4">
            <button onClick={() => router.back()} className="p-2 -ml-2">
              <ArrowLeft className="h-5 w-5 text-[#111827]" />
            </button>
            <h1 className="text-lg font-semibold text-[#111827] ml-2">
              Nouvelle publication
            </h1>
          </div>
        </header>

        <div className="p-4 space-y-4 max-w-lg mx-auto">
          <p className="text-[#4B5563] text-center mb-2">
            Que souhaitez-vous publier ?
          </p>

          <button
            onClick={() => setPublishType("post")}
            className="w-full p-5 rounded-2xl bg-white border border-[#E5E7EB] active:border-[#F39A1F] flex items-center gap-4 text-left transition-all"
          >
            <div className="w-14 h-14 rounded-full bg-[#F39A1F]/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-7 w-7 text-[#F39A1F]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#111827]">Publication</h3>
              <p className="text-sm text-[#4B5563]">
                Photo, vidéo ou note vocale
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-[#9CA3AF]" />
          </button>

          <button
            onClick={() => setPublishType("product")}
            className="w-full p-5 rounded-2xl bg-white border border-[#E5E7EB] active:border-[#2F7D32] flex items-center gap-4 text-left transition-all"
          >
            <div className="w-14 h-14 rounded-full bg-[#2F7D32]/10 flex items-center justify-center flex-shrink-0">
              <Package className="h-7 w-7 text-[#2F7D32]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#111827]">Produit à vendre</h3>
              <p className="text-sm text-[#4B5563]">Mettez en vente un produit</p>
            </div>
            <ChevronRight className="h-5 w-5 text-[#9CA3AF]" />
          </button>
        </div>
      </div>
    )
  }

  // Formulaire POST
  if (publishType === "post") {
    return (
      <div className="min-h-dvh bg-[#FFF6E5] pb-48">
        {HiddenInputs}
        <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB] safe-top">
          <div className="flex items-center justify-between h-14 px-4">
            <button
              onClick={() => {
                setPublishType(null)
                resetMedia()
                setPostContent("")
              }}
              className="p-2 -ml-2"
            >
              <ArrowLeft className="h-5 w-5 text-[#111827]" />
            </button>
            <h1 className="text-lg font-semibold text-[#111827]">
              Nouvelle publication
            </h1>
            <Button
              onClick={handleSubmitPost}
              disabled={
                isSubmitting ||
                (!postContent.trim() && images.length === 0 && !video && !audio)
              }
              className="bg-[#F39A1F] hover:bg-[#E08A10] text-white rounded-full px-5 h-9 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Publier"
              )}
            </Button>
          </div>
        </header>

        <div className="p-4 max-w-lg mx-auto">
          <Textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder={
              audio
                ? "Légende (optionnelle) — votre note vocale suffit"
                : "Quoi de neuf ? Partagez une actualité, une question ou un conseil…"
            }
            className="min-h-[110px] border-0 bg-transparent text-[#111827] placeholder:text-[#9CA3AF] text-base resize-none focus-visible:ring-0 p-0"
            autoFocus
          />

          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {images.map((img, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-xl overflow-hidden bg-[#E5E7EB]"
                >
                  <Image
                    src={img.preview}
                    alt={`Image ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">{MediaExtras}</div>

          {isRecording && (
            <p className="mt-3 text-sm text-red-600 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              Enregistrement en cours…
            </p>
          )}

          <ProgressBar color="#F39A1F" />
        </div>

        {/* Barre outils - au-dessus de la bottom nav */}
        <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-0 right-0 bg-white border-t border-[#E5E7EB] px-2 py-2 z-40">
          <div className="max-w-lg mx-auto">
            <MediaToolbar imageMax={4} />
          </div>
        </div>
      </div>
    )
  }

  // Formulaire PRODUIT
  return (
    <div className="min-h-dvh bg-[#FFF6E5] pb-44">
      {HiddenInputs}
      <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB] safe-top">
        <div className="flex items-center justify-between h-14 px-4">
          <button
            onClick={() => {
              setPublishType(null)
              resetMedia()
              setProductForm({
                name: "",
                description: "",
                price: "",
                unit: "kg",
                stock_quantity: "",
                category_id: "",
                product_type: "agriculture",
              })
            }}
            className="p-2 -ml-2"
          >
            <ArrowLeft className="h-5 w-5 text-[#111827]" />
          </button>
          <h1 className="text-lg font-semibold text-[#111827]">Nouveau produit</h1>
          <Button
            onClick={handleSubmitProduct}
            disabled={
              isSubmitting ||
              !productForm.name ||
              !productForm.price ||
              !productForm.category_id
            }
            className="bg-[#2F7D32] hover:bg-[#256025] text-white rounded-full px-5 h-9 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publier"}
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        {/* Images */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-3 block">
            Photos du produit
          </label>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {images.map((img, index) => (
              <div
                key={index}
                className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#E5E7EB]"
              >
                <Image src={img.preview} alt="" fill className="object-cover" />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
            {images.length < 5 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-[#E5E7EB] flex flex-col items-center justify-center gap-1 flex-shrink-0 active:border-[#2F7D32]"
              >
                <Camera className="h-5 w-5 text-[#9CA3AF]" />
                <span className="text-[10px] text-[#9CA3AF]">Ajouter</span>
              </button>
            )}
          </div>
        </div>

        {/* Vidéo + Note vocale */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-3 block">
            Vidéo &amp; note vocale{" "}
            <span className="text-[#9CA3AF] font-normal">(optionnel)</span>
          </label>
          <div className="mb-3">
            <MediaToolbar imageMax={5} />
          </div>
          {isRecording && (
            <p className="mb-3 text-sm text-red-600 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              Enregistrement en cours…
            </p>
          )}
          {MediaExtras}
        </div>

        <ProgressBar color="#2F7D32" />

        {/* Type */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-3 block">
            Type de produit
          </label>
          <div className="py-3 px-4 rounded-xl text-sm font-medium bg-[#2F7D32] text-white">
            Agriculture
          </div>
        </div>

        {/* Catégorie */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-3 block">
            Catégorie *
          </label>
          <div className="flex flex-wrap gap-2">
            {filteredCategories.slice(0, 12).map((cat) => (
              <button
                key={cat.id}
                onClick={() =>
                  setProductForm({ ...productForm, category_id: cat.id })
                }
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  productForm.category_id === cat.id
                    ? "bg-[#111827] text-white"
                    : "bg-white border border-[#E5E7EB] text-[#4B5563]",
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Nom */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-2 block">
            Nom du produit *
          </label>
          <Input
            value={productForm.name}
            onChange={(e) =>
              setProductForm({ ...productForm, name: e.target.value })
            }
            placeholder="Ex: Cacao bio premium"
            className="h-12 rounded-xl border-[#E5E7EB] bg-white"
          />
        </div>

        {/* Prix & Unité */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-[#111827] mb-2 block">
              Prix (FCFA) *
            </label>
            <Input
              type="number"
              inputMode="numeric"
              value={productForm.price}
              onChange={(e) =>
                setProductForm({ ...productForm, price: e.target.value })
              }
              placeholder="0"
              className="h-12 rounded-xl border-[#E5E7EB] bg-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#111827] mb-2 block">
              Unité
            </label>
            <select
              value={productForm.unit}
              onChange={(e) =>
                setProductForm({ ...productForm, unit: e.target.value })
              }
              className="w-full h-12 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm"
            >
              <option value="kg">Kilogramme</option>
              <option value="g">Gramme</option>
              <option value="L">Litre</option>
              <option value="piece">Pièce</option>
              <option value="sac">Sac</option>
              <option value="lot">Lot</option>
            </select>
          </div>
        </div>

        {/* Stock */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-2 block">
            Quantité disponible
          </label>
          <Input
            type="number"
            inputMode="numeric"
            value={productForm.stock_quantity}
            onChange={(e) =>
              setProductForm({ ...productForm, stock_quantity: e.target.value })
            }
            placeholder="Ex: 100"
            className="h-12 rounded-xl border-[#E5E7EB] bg-white"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-[#111827] mb-2 block">
            Description{" "}
            {audio && (
              <span className="text-[#9CA3AF] font-normal">
                (optionnelle — note vocale ajoutée)
              </span>
            )}
          </label>
          <Textarea
            value={productForm.description}
            onChange={(e) =>
              setProductForm({ ...productForm, description: e.target.value })
            }
            placeholder="Décrivez votre produit…"
            className="min-h-[100px] rounded-xl border-[#E5E7EB] bg-white resize-none"
          />
        </div>
      </div>

      {/* Bouton fixe - au-dessus de la bottom nav */}
      <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-0 right-0 p-4 bg-white border-t border-[#E5E7EB] z-40">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleSubmitProduct}
            disabled={
              isSubmitting ||
              !productForm.name ||
              !productForm.price ||
              !productForm.category_id
            }
            className="w-full h-12 rounded-full bg-[#2F7D32] hover:bg-[#256025] text-white text-base font-semibold disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Publier le produit"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
