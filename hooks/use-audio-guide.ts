"use client"

import { useCallback, useRef, useState, useEffect } from "react"

interface AudioGuideOptions {
  lang?: "fr" | "en" | "dioula"
  rate?: number
  pitch?: number
  volume?: number
}

// Hook pour le guide audio Africa First
// Per spec: "TTS/STT integre. Navigation 100% guidee par audio possible."
export function useAudioGuide(options: AudioGuideOptions = {}) {
  const { lang = "fr", rate = 0.9, pitch = 1, volume = 1 } = options
  
  const [isSupported, setIsSupported] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  
  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && "speechSynthesis" in window)
    
    // Check user preference
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gwa-audio-guide")
      setIsEnabled(saved === "true")
    }
  }, [])
  
  const speak = useCallback((text: string) => {
    if (!isSupported || !isEnabled) return
    
    // Stop any current speech
    window.speechSynthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === "fr" ? "fr-FR" : lang === "en" ? "en-US" : "fr-FR" // Dioula fallback to French
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.volume = volume
    
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [isSupported, isEnabled, lang, rate, pitch, volume])
  
  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [isSupported])
  
  const toggle = useCallback(() => {
    const newValue = !isEnabled
    setIsEnabled(newValue)
    localStorage.setItem("gwa-audio-guide", String(newValue))
    
    if (newValue) {
      speak("Guide audio active. Touchez un element pour entendre sa description.")
    } else {
      stop()
    }
  }, [isEnabled, speak, stop])
  
  // Announce page change
  const announceScreen = useCallback((screenName: string, description?: string) => {
    const text = description ? `${screenName}. ${description}` : screenName
    speak(text)
  }, [speak])
  
  // Announce action result
  const announceAction = useCallback((action: string, success: boolean = true) => {
    const successText = success ? "avec succes" : "echec"
    speak(`${action} ${successText}`)
  }, [speak])
  
  return {
    isSupported,
    isSpeaking,
    isEnabled,
    speak,
    stop,
    toggle,
    announceScreen,
    announceAction,
  }
}

// Audio descriptions pour les ecrans principaux (accessibilite)
export const SCREEN_DESCRIPTIONS: Record<string, { fr: string; en: string }> = {
  "/": {
    fr: "Page d'accueil. Decouvrez les derniers produits et publications.",
    en: "Home page. Discover the latest products and posts.",
  },
  "/marketplace": {
    fr: "Marketplace. Achetez des produits de producteurs et artisans verifies.",
    en: "Marketplace. Buy products from verified farmers and artisans.",
  },
  "/messages": {
    fr: "Messagerie. Discutez avec vos vendeurs et acheteurs.",
    en: "Messages. Chat with your sellers and buyers.",
  },
  "/profil": {
    fr: "Votre profil. Gerez vos informations et parametres.",
    en: "Your profile. Manage your information and settings.",
  },
  "/publier": {
    fr: "Publier. Ajoutez un nouveau produit ou une publication.",
    en: "Publish. Add a new product or post.",
  },
  "/wallet": {
    fr: "Portefeuille. Gerez votre solde et vos transactions.",
    en: "Wallet. Manage your balance and transactions.",
  },
  "/communaute": {
    fr: "Communaute. Partagez et echangez avec d'autres membres.",
    en: "Community. Share and connect with other members.",
  },
}

// Action announcements
export const ACTION_DESCRIPTIONS: Record<string, { fr: string; en: string }> = {
  "add_to_cart": { fr: "Produit ajoute au panier", en: "Product added to cart" },
  "remove_from_cart": { fr: "Produit retire du panier", en: "Product removed from cart" },
  "order_placed": { fr: "Commande passee avec succes", en: "Order placed successfully" },
  "message_sent": { fr: "Message envoye", en: "Message sent" },
  "product_published": { fr: "Produit publie", en: "Product published" },
  "post_published": { fr: "Publication partagee", en: "Post shared" },
  "profile_updated": { fr: "Profil mis a jour", en: "Profile updated" },
  "payment_success": { fr: "Paiement reussi", en: "Payment successful" },
  "payment_failed": { fr: "Paiement echoue. Reessayez.", en: "Payment failed. Please retry." },
}
