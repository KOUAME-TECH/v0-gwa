import { type NextRequest, NextResponse } from "next/server"

import {

  DEFAULT_ADMIN_PERMISSIONS,

  DEFAULT_SUPPORT_PERMISSIONS,

} from "@/lib/auth/admin-permissions"

import { requireAdmin, requireSuperAdmin } from "@/lib/auth/require-admin"

import { checkRateLimit } from "@/lib/security/rate-limiter"



type Ctx = { params: Promise<{ id: string }> }



const PROFILE_ACTIONS = new Set(["verify", "unverify", "suspend", "unsuspend"])

const ROLE_ACTIONS = new Set(["grant_support", "grant_admin", "revoke_admin"])



/**

 * PATCH /api/admin/users/[id]

 * Mutations profil + gestion rôles admin (super_admin pour les rôles).

 */

export async function PATCH(request: NextRequest, context: Ctx) {

  try {

    const rate = await checkRateLimit("API_CREATE")

    if (!rate.success) {

      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })

    }



    const { id } = await context.params

    const body = await request.json().catch(() => ({}))

    const action = String(body?.action || "")



    if (ROLE_ACTIONS.has(action)) {

      const gate = await requireSuperAdmin()

      if (!gate.isAdmin || !gate.admin) {

        return NextResponse.json(

          { error: gate.error || "Accès refusé" },

          { status: gate.user ? 403 : 401 },

        )

      }



      if (id === gate.user.id) {

        return NextResponse.json(

          { error: "Vous ne pouvez pas modifier votre propre rôle admin" },

          { status: 400 },

        )

      }



      const { data: targetProfile } = await gate.admin

        .from("profiles")

        .select("id, email, full_name")

        .eq("id", id)

        .maybeSingle()



      if (!targetProfile) {

        return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })

      }



      if (action === "revoke_admin") {

        const { data: existingRole } = await gate.admin

          .from("admin_roles")

          .select("id, role")

          .eq("user_id", id)

          .maybeSingle()



        if (!existingRole) {

          return NextResponse.json({ error: "Cet utilisateur n'a pas de rôle admin" }, { status: 400 })

        }



        if (existingRole.role === "super_admin") {

          return NextResponse.json(

            { error: "Impossible de révoquer un super administrateur via l'interface" },

            { status: 403 },

          )

        }



        const { error } = await gate.admin

          .from("admin_roles")

          .update({

            is_active: false,

            updated_at: new Date().toISOString(),

          })

          .eq("user_id", id)



        if (error) {

          return NextResponse.json({ error: error.message }, { status: 400 })

        }



        return NextResponse.json({ success: true, admin_role: null })

      }



      const newRole = action === "grant_support" ? "support" : "admin"

      const permissions =

        newRole === "support" ? DEFAULT_SUPPORT_PERMISSIONS : DEFAULT_ADMIN_PERMISSIONS



      const { data: roleRow, error: roleErr } = await gate.admin

        .from("admin_roles")

        .upsert(

          {

            user_id: id,

            role: newRole,

            permissions,

            is_active: true,

            created_by: gate.user.id,

            updated_at: new Date().toISOString(),

          },

          { onConflict: "user_id" },

        )

        .select("user_id, role, is_active")

        .single()



      if (roleErr) {

        return NextResponse.json({ error: roleErr.message }, { status: 400 })

      }



      return NextResponse.json({ success: true, admin_role: roleRow })

    }



    if (!PROFILE_ACTIONS.has(action)) {

      return NextResponse.json(

        {

          error:

            "action requise: verify|unverify|suspend|unsuspend|grant_support|grant_admin|revoke_admin",

        },

        { status: 400 },

      )

    }



    const gate = await requireAdmin()

    if (!gate.isAdmin || !gate.admin) {

      return NextResponse.json(

        { error: gate.error || "Accès refusé" },

        { status: gate.user ? 403 : 401 },

      )

    }



    if (id === gate.user.id && (action === "suspend" || action === "unverify")) {

      return NextResponse.json(

        { error: "Action interdite sur votre propre compte" },

        { status: 400 },

      )

    }



    const { data: existingProfile } = await gate.admin
      .from("profiles")
      .select("id, is_verified, is_suspended")
      .eq("id", id)
      .maybeSingle()

    if (!existingProfile) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
    }

    // Idempotence : déjà dans l'état cible → succès sans réécrire
    if (action === "verify" && existingProfile.is_verified === true) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        profile: existingProfile,
      })
    }
    if (action === "unverify" && existingProfile.is_verified === false) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        profile: existingProfile,
      })
    }
    if (action === "suspend" && existingProfile.is_suspended === true) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        profile: existingProfile,
      })
    }
    if (action === "unsuspend" && existingProfile.is_suspended === false) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        profile: existingProfile,
      })
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (action === "verify") {
      updates.is_verified = true
    } else if (action === "unverify") {
      updates.is_verified = false
    } else if (action === "suspend") {
      updates.is_suspended = true
      updates.suspended_reason = String(body?.reason || "Suspendu par admin").slice(0, 500)
      updates.suspended_at = new Date().toISOString()
      updates.suspended_by = gate.user.id
    } else if (action === "unsuspend") {
      updates.is_suspended = false
      updates.suspended_reason = null
      updates.suspended_at = null
      updates.suspended_by = null
    }

    const { data, error } = await gate.admin
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select("id, is_verified, is_suspended")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, idempotent: false, profile: data })

  } catch (err) {

    console.error("[api/admin/users]", err)

    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })

  }

}


