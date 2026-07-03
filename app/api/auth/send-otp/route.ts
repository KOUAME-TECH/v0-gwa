// POST /api/auth/send-otp
// Envoie un OTP SMS via Africa's Talking + Supabase Phone Auth

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateCIPhone, normalizeCIPhone } from '@/lib/gwa/phone'
import { enforceRateLimit } from '@/lib/gwa/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, country = 'CI' } = body as { phone: string; country?: string }

    if (!phone) {
      return NextResponse.json({ error: 'Numéro de téléphone requis' }, { status: 400 })
    }

    // Validation format CI
    if (country === 'CI' && !validateCIPhone(phone)) {
      return NextResponse.json({
        error: 'Numéro invalide. Format CI requis (ex: 07 12 34 56 78)',
      }, { status: 400 })
    }

    const normalized = normalizeCIPhone(phone)

    // Rate limiting : 5 tentatives / heure par numéro
    const rl = await enforceRateLimit(`otp:${normalized}`, 'otp_send')
    if (rl) return rl

    // Utiliser Supabase Auth Phone OTP
    // Supabase déclenche l'envoi SMS via le provider configuré (AT ou Twilio)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { error } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: {
        shouldCreateUser: true,
      },
    })

    if (error) {
      // Erreur connue : trop de tentatives côté Supabase
      if (error.message.includes('rate') || error.status === 429) {
        return NextResponse.json({
          error: 'Trop de tentatives. Attendez 1 heure avant de réessayer.',
        }, { status: 429 })
      }
      throw error
    }

    return NextResponse.json({
      success:    true,
      expires_in: 600,  // 10 minutes
      message:    'Code SMS envoyé',
    })
  } catch (err) {
    console.error('[send-otp] Error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi du SMS. Vérifiez la configuration Africa\'s Talking.' },
      { status: 503 }
    )
  }
}
