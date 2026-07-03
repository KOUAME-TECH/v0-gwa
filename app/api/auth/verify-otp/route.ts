// POST /api/auth/verify-otp
// Vérifie l'OTP + crée la session JWT Supabase

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeCIPhone } from '@/lib/gwa/phone'
import { enforceRateLimit } from '@/lib/gwa/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, otp } = body as { phone: string; otp: string }

    if (!phone || !otp) {
      return NextResponse.json(
        { error: 'Numéro de téléphone et code OTP requis' },
        { status: 400 }
      )
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: 'Code OTP invalide. 6 chiffres requis.' },
        { status: 400 }
      )
    }

    const normalized = normalizeCIPhone(phone)

    // Rate limiting : 10 essais / 10 min par numéro
    const rl = await enforceRateLimit(`otp_verify:${normalized}`, 'otp_verify')
    if (rl) return rl

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )

    // Vérifier l'OTP via Supabase Auth
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: otp,
      type: 'sms',
    })

    if (error) {
      if (error.message.includes('expired')) {
        return NextResponse.json(
          { error: 'Code expiré. Demandez un nouveau code.' },
          { status: 400 }
        )
      }
      if (error.message.includes('invalid')) {
        return NextResponse.json(
          { error: 'Code incorrect. Vérifiez et réessayez.' },
          { status: 400 }
        )
      }
      throw error
    }

    if (!data.user || !data.session) {
      return NextResponse.json({ error: 'Vérification échouée' }, { status: 400 })
    }

    // Vérifier si c'est un nouvel utilisateur (profil existant ?)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, sub_type, profile_completion_pct')
      .eq('id', data.user.id)
      .single()

    const is_new_user = !profile?.full_name

    // Mettre à jour last_login_at
    await supabaseAdmin
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id)

    return NextResponse.json({
      user_id:       data.user.id,
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at:    data.session.expires_at,
      is_new_user,
      profile:       profile || null,
    })
  } catch (err) {
    console.error('[verify-otp] Error:', err)
    return NextResponse.json(
      { error: 'Erreur de vérification OTP' },
      { status: 500 }
    )
  }
}
