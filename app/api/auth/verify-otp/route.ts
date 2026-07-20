import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { formatPhoneE164, validateWestAfricaPhone } from "@/lib/auth/phone"
import {
  resolvePostAuthRedirect,
  computeProfileCompletion,
  USER_TYPE_MAP,
} from "@/lib/auth/post-auth"
import {
  getOtp,
  bumpOtpAttempts,
  clearOtp,
  verifyOtpHash,
} from "@/lib/auth/otp-store"

async function runScg(userId: string) {
  try {
    const admin = createAdminClient()
    const { aggregateProducerData } = await import("@/lib/scg/aggregate")
    const { calculateSCG } = await import("@/lib/scg/engine")
    const scgData = await aggregateProducerData(userId)
    const scg = calculateSCG(scgData)
    await admin.from("scg_scores").insert({
      user_id: userId,
      score_total: scg.score_total,
      badge: scg.badge,
      bancable: scg.bancable,
      dim_fiabilite: scg.dimensions.fiabilite,
      dim_qualite: scg.dimensions.qualite,
      dim_engagement: scg.dimensions.engagement,
      dim_volumes: scg.dimensions.volumes,
      dim_stabilite: scg.dimensions.stabilite,
      recommandation: scg.recommandation,
    })
    await admin
      .from("profiles")
      .update({
        scg_score: scg.score_total,
        scg_badge: scg.badge,
        scg_bancable: scg.bancable,
        scg_calculated_at: scg.calculated_at,
      })
      .eq("id", userId)
  } catch (scgErr) {
    console.error("[auth/verify-otp] SCG:", scgErr)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      phone,
      countryCode = "ci",
      otp,
      profile: profileData,
    } = body

    if (!phone || !otp) {
      return NextResponse.json(
        { error: "Téléphone et code OTP requis" },
        { status: 400 },
      )
    }

    const formatted = formatPhoneE164(phone, countryCode)
    if (!formatted || !validateWestAfricaPhone(phone, countryCode)) {
      return NextResponse.json({ error: "Numéro invalide" }, { status: 400 })
    }

    const rateLimit = await checkRateLimit("OTP_REQUEST", `verify:${formatted}`)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Trop de tentatives de vérification" },
        { status: 429 },
      )
    }

    const token = String(otp).replace(/\s/g, "")
    if (!/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: "Le code doit contenir 6 chiffres" },
        { status: 400 },
      )
    }

    const supabase = await createClient()

    // 1) OTP custom (email lié / Twilio)
    const stored = await getOtp(formatted)
    if (stored) {
      if (stored.attempts >= 5) {
        await clearOtp(formatted)
        return NextResponse.json(
          { error: "Trop d'essais. Demandez un nouveau code." },
          { status: 429 },
        )
      }
      if (!verifyOtpHash(token, stored.codeHash)) {
        await bumpOtpAttempts(formatted)
        return NextResponse.json(
          { error: "Code incorrect ou expiré" },
          { status: 400 },
        )
      }

      const admin = createAdminClient()

      // BIND — l'utilisateur est déjà authentifié et lie ce numéro à SON compte.
      // On n'ouvre PAS de nouvelle session : on exige que la session courante
      // corresponde exactement à l'utilisateur ciblé, puis on écrit le numéro.
      if (stored.mode === "bind") {
        const {
          data: { user: sessionUser },
        } = await supabase.auth.getUser()

        if (!sessionUser || sessionUser.id !== stored.userId) {
          return NextResponse.json(
            {
              error:
                "Session requise pour lier ce numéro. Connectez-vous puis réessayez.",
            },
            { status: 401 },
          )
        }

        await clearOtp(formatted)

        await admin
          .from("profiles")
          .update({
            phone: formatted,
            phone_verified: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionUser.id)

        await admin.auth.admin.updateUserById(sessionUser.id, {
          phone: formatted,
          user_metadata: { phone: formatted },
        })

        const { path, isNewUser } = await resolvePostAuthRedirect(
          supabase,
          sessionUser.id,
        )
        await runScg(sessionUser.id)

        return NextResponse.json({
          success: true,
          is_new_user: isNewUser,
          redirect_to: path,
          bound: true,
          user: { id: sessionUser.id, phone: formatted },
        })
      }

      const { data: linkData, error: linkError } =
        await admin.auth.admin.generateLink({
          type: "magiclink",
          email: stored.email,
        })

      if (linkError || !linkData?.properties?.hashed_token) {
        console.error("[auth/verify-otp] generateLink", linkError?.message)
        return NextResponse.json(
          { error: "Impossible de créer la session. Réessayez." },
          { status: 500 },
        )
      }

      const { data, error } = await supabase.auth.verifyOtp({
        type: "email",
        token_hash: linkData.properties.hashed_token,
      })

      if (error || !data.user) {
        console.error("[auth/verify-otp] session", error?.message)
        return NextResponse.json(
          { error: "Session expirée. Demandez un nouveau code." },
          { status: 400 },
        )
      }

      await clearOtp(formatted)

      await admin
        .from("profiles")
        .update({
          phone: formatted,
          phone_verified: true,
          linked_email: stored.email,
          email: stored.email,
          auth_method: "phone",
          updated_at: new Date().toISOString(),
        })
        .eq("id", stored.userId)

      // Garder phone sur auth metadata
      await admin.auth.admin.updateUserById(stored.userId, {
        phone: formatted,
        user_metadata: {
          phone: formatted,
          linked_email: stored.email,
        },
      })

      if (profileData) {
        const mappedType = profileData.userType
          ? USER_TYPE_MAP[profileData.userType] || profileData.userType
          : undefined
        const profileUpdate = {
          phone: formatted,
          full_name: profileData.name || undefined,
          user_type: mappedType,
          country: profileData.country || undefined,
          city: profileData.city || undefined,
          auth_method: "phone" as const,
        }
        const completion = computeProfileCompletion({
          ...profileUpdate,
          email: stored.email,
        })
        await supabase
          .from("profiles")
          .update({
            ...profileUpdate,
            profile_completion_pct: completion,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.user.id)
      }

      const { path, isNewUser } = await resolvePostAuthRedirect(
        supabase,
        data.user.id,
      )
      await runScg(data.user.id)

      return NextResponse.json({
        success: true,
        is_new_user: isNewUser,
        redirect_to: path,
        user: { id: data.user.id, phone: formatted, email: stored.email },
      })
    }

    // 2) Fallback SMS Supabase natif
    const { data, error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token,
      type: "sms",
    })

    if (error || !data.user) {
      return NextResponse.json(
        { error: "Code incorrect ou expiré" },
        { status: 400 },
      )
    }

    if (profileData) {
      const mappedType = profileData.userType
        ? USER_TYPE_MAP[profileData.userType] || profileData.userType
        : undefined

      const profileUpdate = {
        phone: formatted,
        full_name: profileData.name || undefined,
        user_type: mappedType,
        country: profileData.country || undefined,
        city: profileData.city || undefined,
        auth_method: "phone" as const,
      }

      const completion = computeProfileCompletion({
        ...profileUpdate,
        email: data.user.email,
      })

      await supabase
        .from("profiles")
        .update({
          ...profileUpdate,
          profile_completion_pct: completion,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.user.id)

      await supabase.auth.updateUser({
        data: {
          full_name: profileData.name,
          user_type: mappedType,
          country: profileData.country,
          city: profileData.city,
          phone: formatted,
        },
      })
    } else {
      await supabase
        .from("profiles")
        .update({
          phone: formatted,
          phone_verified: true,
          auth_method: "phone",
        })
        .eq("id", data.user.id)
    }

    const { path, isNewUser } = await resolvePostAuthRedirect(
      supabase,
      data.user.id,
    )
    await runScg(data.user.id)

    return NextResponse.json({
      success: true,
      is_new_user: isNewUser,
      redirect_to: path,
      user: {
        id: data.user.id,
        phone: formatted,
      },
    })
  } catch (err) {
    console.error("[auth/verify-otp]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
