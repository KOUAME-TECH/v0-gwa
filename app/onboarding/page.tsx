"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useAudioGuide } from "@/hooks/use-audio-guide"
import { 
  ChevronRight, ChevronLeft, Volume2, VolumeX, Check,
  User, ShoppingBag, Leaf, Truck, MessageCircle
} from "lucide-react"
import { PictoFarmer, PictoShop, PictoArtisan, PictoVerified } from "@/components/gwa/pictograms"

// Per spec: "Onboarding (4 etapes) - Audio guide chaque etape. Pictogrammes > texte."

type UserType = "buyer" | "farmer" | "artisan" | "cooperative" | "processor"

interface OnboardingData {
  displayName: string
  userType: UserType | null
  phone: string
  interests: string[]
}

const STEPS = [
  { 
    title: "Bienvenue sur GWA", 
    audio: "Bienvenue sur GWA, la plateforme qui connecte producteurs et acheteurs en Afrique de l'Ouest. Glissez pour continuer."
  },
  { 
    title: "Qui etes-vous?", 
    audio: "Etes-vous un acheteur, un producteur agricole, un artisan, ou une cooperative? Selectionnez votre profil."
  },
  { 
    title: "Vos informations", 
    audio: "Entrez votre nom et votre numero de telephone pour que les autres puissent vous contacter."
  },
  { 
    title: "Vos interets", 
    audio: "Selectionnez les categories qui vous interessent pour personnaliser votre experience."
  },
]

const USER_TYPES: { id: UserType; label: string; description: string; Icon: any }[] = [
  { id: "buyer", label: "Acheteur", description: "Je veux acheter des produits", Icon: ShoppingBag },
  { id: "farmer", label: "Producteur", description: "Je vends mes recoltes", Icon: PictoFarmer },
  { id: "artisan", label: "Artisan", description: "Je vends mes creations", Icon: PictoArtisan },
  { id: "cooperative", label: "Cooperative", description: "Je represente une cooperative", Icon: Truck },
]

const INTERESTS = [
  { id: "fruits", label: "Fruits", icon: "🍊" },
  { id: "legumes", label: "Legumes", icon: "🥬" },
  { id: "cereales", label: "Cereales", icon: "🌾" },
  { id: "cacao", label: "Cacao/Cafe", icon: "☕" },
  { id: "noix", label: "Noix/Cajou", icon: "🥜" },
  { id: "artisanat", label: "Artisanat", icon: "🎨" },
  { id: "textile", label: "Textile", icon: "👕" },
  { id: "cosmetique", label: "Cosmetique", icon: "🧴" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    displayName: "",
    userType: null,
    phone: "",
    interests: [],
  })
  const [loading, setLoading] = useState(false)
  
  const { speak, isEnabled, toggle: toggleAudio, isSpeaking, stop } = useAudioGuide()
  
  // Announce step on change
  useEffect(() => {
    if (isEnabled) {
      speak(STEPS[step].audio)
    }
    return () => stop()
  }, [step, isEnabled])
  
  const canProceed = () => {
    switch (step) {
      case 0: return true
      case 1: return data.userType !== null
      case 2: return data.displayName.length >= 2
      case 3: return data.interests.length >= 1
      default: return false
    }
  }
  
  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      // Complete onboarding
      setLoading(true)
      
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        await supabase.from("profiles").update({
          display_name: data.displayName,
          user_type: data.userType,
          phone: data.phone || null,
          interests: data.interests,
          onboarding_completed: true,
        }).eq("id", user.id)
      }
      
      router.push("/")
    }
  }
  
  const toggleInterest = (id: string) => {
    setData(prev => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter(i => i !== id)
        : [...prev.interests, id],
    }))
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF6E5] to-white flex flex-col">
      {/* Header with audio toggle */}
      <header className="flex items-center justify-between p-4">
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div 
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i <= step ? "w-8 bg-[#2F7D32]" : "w-4 bg-gray-200"
              )}
            />
          ))}
        </div>
        <button
          onClick={toggleAudio}
          className={cn(
            "p-2 rounded-full transition-colors",
            isEnabled ? "bg-[#2F7D32]/10 text-[#2F7D32]" : "bg-gray-100 text-gray-400"
          )}
          aria-label={isEnabled ? "Desactiver le guide audio" : "Activer le guide audio"}
        >
          {isEnabled ? (
            <Volume2 className={cn("h-5 w-5", isSpeaking && "animate-pulse")} />
          ) : (
            <VolumeX className="h-5 w-5" />
          )}
        </button>
      </header>
      
      {/* Content */}
      <div className="flex-1 px-6 py-4">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-32 h-32 bg-gradient-to-br from-[#2F7D32] to-[#4CAF50] rounded-full flex items-center justify-center mb-6 shadow-lg shadow-[#2F7D32]/30">
              <Leaf className="h-16 w-16 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-[#1c1917] mb-3">Bienvenue sur GWA</h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-xs">
              La super app qui connecte les producteurs et artisans africains au monde entier
            </p>
            
            <div className="grid grid-cols-3 gap-4 mt-8 w-full max-w-xs">
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-[#F39A1F]/10 flex items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-[#F39A1F]" />
                </div>
                <span className="text-[10px] text-muted-foreground">Acheter</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-[#2F7D32]/10 flex items-center justify-center">
                  <Truck className="h-6 w-6 text-[#2F7D32]" />
                </div>
                <span className="text-[10px] text-muted-foreground">Vendre</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-[#1DA1F2]/10 flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-[#1DA1F2]" />
                </div>
                <span className="text-[10px] text-muted-foreground">Discuter</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Step 1: User Type */}
        {step === 1 && (
          <div className="h-full">
            <h2 className="text-2xl font-bold text-[#1c1917] mb-2">Qui etes-vous?</h2>
            <p className="text-muted-foreground mb-6">Selectionnez votre profil pour personnaliser votre experience</p>
            
            <div className="space-y-3">
              {USER_TYPES.map(({ id, label, description, Icon }) => (
                <button
                  key={id}
                  onClick={() => setData(prev => ({ ...prev, userType: id }))}
                  className={cn(
                    "w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all",
                    data.userType === id 
                      ? "border-[#2F7D32] bg-[#2F7D32]/5" 
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center",
                    data.userType === id ? "bg-[#2F7D32]" : "bg-gray-100"
                  )}>
                    {typeof Icon === "function" ? (
                      <Icon size={28} className={data.userType === id ? "text-white" : "text-gray-600"} />
                    ) : (
                      <Icon className={cn("h-7 w-7", data.userType === id ? "text-white" : "text-gray-600")} />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-lg">{label}</div>
                    <div className="text-sm text-muted-foreground">{description}</div>
                  </div>
                  {data.userType === id && (
                    <div className="w-6 h-6 rounded-full bg-[#2F7D32] flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Step 2: Personal Info */}
        {step === 2 && (
          <div className="h-full">
            <h2 className="text-2xl font-bold text-[#1c1917] mb-2">Vos informations</h2>
            <p className="text-muted-foreground mb-6">Comment voulez-vous etre appele?</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Votre nom ou pseudo</label>
                <Input
                  value={data.displayName}
                  onChange={e => setData(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="ex: Konan Agricole"
                  className="h-14 text-lg"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Numero de telephone <span className="text-muted-foreground">(optionnel)</span>
                </label>
                <Input
                  type="tel"
                  value={data.phone}
                  onChange={e => setData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="07 XX XX XX XX"
                  className="h-14 text-lg"
                />
              </div>
            </div>
            
            <div className="mt-6 p-4 rounded-xl bg-[#2F7D32]/5 border border-[#2F7D32]/20">
              <div className="flex gap-3">
                <PictoVerified size={24} />
                <div>
                  <div className="font-medium text-sm">Profil verifie = plus de confiance</div>
                  <div className="text-xs text-muted-foreground">Vous pourrez verifier votre identite plus tard pour obtenir le badge verifie</div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Step 3: Interests */}
        {step === 3 && (
          <div className="h-full">
            <h2 className="text-2xl font-bold text-[#1c1917] mb-2">Vos interets</h2>
            <p className="text-muted-foreground mb-6">Selectionnez au moins une categorie</p>
            
            <div className="grid grid-cols-2 gap-3">
              {INTERESTS.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => toggleInterest(id)}
                  className={cn(
                    "p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all",
                    data.interests.includes(id) 
                      ? "border-[#F39A1F] bg-[#F39A1F]/5" 
                      : "border-gray-200"
                  )}
                >
                  <span className="text-3xl">{icon}</span>
                  <span className="font-medium text-sm">{label}</span>
                  {data.interests.includes(id) && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#F39A1F] flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Footer Navigation */}
      <footer className="p-6 bg-white border-t safe-bottom">
        <div className="flex gap-3">
          {step > 0 && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => setStep(step - 1)}
              className="flex-1 h-14"
            >
              <ChevronLeft className="h-5 w-5 mr-1" />
              Retour
            </Button>
          )}
          <Button
            size="lg"
            onClick={handleNext}
            disabled={!canProceed() || loading}
            className={cn(
              "h-14 text-base font-semibold",
              step === 0 ? "w-full" : "flex-1"
            )}
          >
            {loading ? (
              "Chargement..."
            ) : step === STEPS.length - 1 ? (
              "Commencer"
            ) : (
              <>
                Continuer
                <ChevronRight className="h-5 w-5 ml-1" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  )
}
