"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, CheckCircle2, AlertCircle, Smartphone } from "lucide-react"

interface MobileMoneyProvider {
  id: "orange" | "mtn" | "wave" | "wallet"
  name: string
  logo: string
  color: string
  bgColor: string
  placeholder: string
}

const PROVIDERS: MobileMoneyProvider[] = [
  { 
    id: "orange", 
    name: "Orange Money", 
    logo: "/icons/orange-money.png",
    color: "#FF6600", 
    bgColor: "bg-[#FF6600]/10",
    placeholder: "07 XX XX XX XX"
  },
  { 
    id: "mtn", 
    name: "MTN MoMo", 
    logo: "/icons/mtn-momo.png",
    color: "#FFCC00", 
    bgColor: "bg-[#FFCC00]/10",
    placeholder: "05 XX XX XX XX"
  },
  { 
    id: "wave", 
    name: "Wave", 
    logo: "/icons/wave.png",
    color: "#1DA1F2", 
    bgColor: "bg-[#1DA1F2]/10",
    placeholder: "01 XX XX XX XX"
  },
  { 
    id: "wallet", 
    name: "Wallet GWA", 
    logo: "/icons/gwa-wallet.png",
    color: "#2F7D32", 
    bgColor: "bg-[#2F7D32]/10",
    placeholder: "Solde disponible"
  },
]

interface MobileMoneyPaymentProps {
  amount: number
  currency?: string
  onSuccess?: (transactionId: string, provider: string) => void
  onError?: (error: string) => void
  walletBalance?: number
  className?: string
}

type PaymentStatus = "idle" | "processing" | "otp" | "success" | "error"

export function MobileMoneyPayment({ 
  amount, 
  currency = "FCFA",
  onSuccess,
  onError,
  walletBalance = 0,
  className 
}: MobileMoneyPaymentProps) {
  const [selectedProvider, setSelectedProvider] = useState<MobileMoneyProvider | null>(null)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [status, setStatus] = useState<PaymentStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  
  const formatAmount = (n: number) => new Intl.NumberFormat("fr-CI").format(n)
  
  const handleProviderSelect = (provider: MobileMoneyProvider) => {
    setSelectedProvider(provider)
    setStatus("idle")
    setPhoneNumber("")
    setOtp("")
    setErrorMessage("")
    
    // Pre-fill for wallet
    if (provider.id === "wallet") {
      setPhoneNumber("wallet")
    }
  }
  
  const validatePhone = (phone: string) => {
    if (selectedProvider?.id === "wallet") return true
    const cleaned = phone.replace(/\s/g, "")
    return /^0[157]\d{8}$/.test(cleaned)
  }
  
  const handleInitiatePayment = async () => {
    if (!selectedProvider) return
    
    // Validate
    if (selectedProvider.id === "wallet") {
      if (walletBalance < amount) {
        setErrorMessage("Solde insuffisant")
        setStatus("error")
        return
      }
    } else if (!validatePhone(phoneNumber)) {
      setErrorMessage("Numero de telephone invalide")
      setStatus("error")
      return
    }
    
    setStatus("processing")
    
    // Simulate API call to Mobile Money provider
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // For wallet, direct payment
      if (selectedProvider.id === "wallet") {
        setStatus("success")
        onSuccess?.(`GWA-${Date.now()}`, "wallet")
        return
      }
      
      // For Mobile Money, request OTP
      setStatus("otp")
    } catch {
      setErrorMessage("Erreur de connexion. Reessayez.")
      setStatus("error")
      onError?.("Connection error")
    }
  }
  
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setErrorMessage("Code OTP invalide (6 chiffres)")
      return
    }
    
    setStatus("processing")
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Simulate success
      const txId = `${selectedProvider?.id?.toUpperCase()}-${Date.now()}`
      setStatus("success")
      onSuccess?.(txId, selectedProvider?.id || "unknown")
    } catch {
      setErrorMessage("Code OTP incorrect")
      setStatus("error")
      onError?.("OTP verification failed")
    }
  }
  
  return (
    <div className={cn("bg-card rounded-2xl border shadow-sm overflow-hidden", className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2F7D32] to-[#1B5E20] px-4 py-3 text-white">
        <div className="text-sm opacity-90">Montant a payer</div>
        <div className="text-2xl font-bold">{formatAmount(amount)} {currency}</div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Provider Selection */}
        {status === "idle" && !selectedProvider && (
          <>
            <p className="text-sm text-muted-foreground text-center mb-3">
              Choisissez votre mode de paiement
            </p>
            <div className="grid grid-cols-2 gap-3">
              {PROVIDERS.map(provider => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderSelect(provider)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    "hover:border-primary/50 active:scale-95",
                    provider.bgColor
                  )}
                  style={{ borderColor: `${provider.color}20` }}
                >
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: provider.color }}
                  >
                    <Smartphone className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-sm font-medium text-center">{provider.name}</span>
                  {provider.id === "wallet" && (
                    <span className="text-xs text-muted-foreground">
                      {formatAmount(walletBalance)} {currency}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
        
        {/* Phone Number Input */}
        {selectedProvider && (status === "idle" || status === "error") && selectedProvider.id !== "wallet" && (
          <div className="space-y-3">
            <button 
              onClick={() => setSelectedProvider(null)}
              className="text-sm text-primary hover:underline"
            >
              ← Changer de mode de paiement
            </button>
            
            <div 
              className={cn("flex items-center gap-3 p-3 rounded-xl", selectedProvider.bgColor)}
              style={{ borderColor: selectedProvider.color }}
            >
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: selectedProvider.color }}
              >
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">{selectedProvider.name}</div>
                <div className="text-xs text-muted-foreground">Paiement securise</div>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">Numero de telephone</label>
              <Input
                type="tel"
                placeholder={selectedProvider.placeholder}
                value={phoneNumber}
                onChange={e => {
                  setPhoneNumber(e.target.value)
                  setErrorMessage("")
                  setStatus("idle")
                }}
                className="h-12 text-lg"
              />
            </div>
            
            {errorMessage && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {errorMessage}
              </div>
            )}
            
            <Button 
              onClick={handleInitiatePayment}
              disabled={!phoneNumber}
              className="w-full h-12 text-base font-semibold"
              style={{ backgroundColor: selectedProvider.color }}
            >
              Payer {formatAmount(amount)} {currency}
            </Button>
          </div>
        )}
        
        {/* Wallet Payment */}
        {selectedProvider?.id === "wallet" && (status === "idle" || status === "error") && (
          <div className="space-y-3">
            <button 
              onClick={() => setSelectedProvider(null)}
              className="text-sm text-primary hover:underline"
            >
              ← Changer de mode de paiement
            </button>
            
            <div className="bg-[#2F7D32]/10 p-4 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Solde Wallet GWA</span>
                <span className="font-bold text-[#2F7D32]">{formatAmount(walletBalance)} {currency}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Apres paiement</span>
                <span className={cn(
                  "font-bold",
                  walletBalance >= amount ? "text-[#2F7D32]" : "text-destructive"
                )}>
                  {formatAmount(Math.max(0, walletBalance - amount))} {currency}
                </span>
              </div>
            </div>
            
            {errorMessage && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {errorMessage}
              </div>
            )}
            
            <Button 
              onClick={handleInitiatePayment}
              disabled={walletBalance < amount}
              className="w-full h-12 text-base font-semibold bg-[#2F7D32] hover:bg-[#256025]"
            >
              {walletBalance >= amount 
                ? `Payer ${formatAmount(amount)} ${currency}` 
                : "Solde insuffisant"
              }
            </Button>
          </div>
        )}
        
        {/* OTP Verification */}
        {status === "otp" && (
          <div className="space-y-3">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#F39A1F]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Smartphone className="h-8 w-8 text-[#F39A1F]" />
              </div>
              <h3 className="font-semibold text-lg">Verification OTP</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Entrez le code recu par SMS au {phoneNumber}
              </p>
            </div>
            
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="• • • • • •"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
              className="h-14 text-2xl text-center tracking-[0.5em] font-mono"
            />
            
            {errorMessage && (
              <div className="flex items-center gap-2 text-destructive text-sm justify-center">
                <AlertCircle className="h-4 w-4" />
                {errorMessage}
              </div>
            )}
            
            <Button 
              onClick={handleVerifyOTP}
              disabled={otp.length !== 6}
              className="w-full h-12 text-base font-semibold"
              style={{ backgroundColor: selectedProvider?.color }}
            >
              Confirmer le paiement
            </Button>
            
            <button className="text-sm text-primary hover:underline w-full text-center">
              Renvoyer le code
            </button>
          </div>
        )}
        
        {/* Processing */}
        {status === "processing" && (
          <div className="py-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <p className="font-medium">Traitement en cours...</p>
            <p className="text-sm text-muted-foreground mt-1">Ne fermez pas cette page</p>
          </div>
        )}
        
        {/* Success */}
        {status === "success" && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-[#2F7D32]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-[#2F7D32]" />
            </div>
            <h3 className="font-bold text-xl text-[#2F7D32]">Paiement reussi!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {formatAmount(amount)} {currency} via {selectedProvider?.name}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
