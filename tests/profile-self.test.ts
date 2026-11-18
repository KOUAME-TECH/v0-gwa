import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  loadOwnProfile,
  PROFILE_SAFE_COLUMNS,
  profileFromRow,
  toDisplayedProfile,
} from "@/lib/profile/self"

const user = { id: "user-1", email: "awa@gwa.ci" }

type RpcError = { message?: string; code?: string; status?: number } | null
type RpcResult = { data: unknown; error: RpcError }

function mockSupabase(rpcResults: RpcResult[], row: Record<string, unknown> | null) {
  let call = 0
  const rpc = vi.fn(async () => {
    const result = rpcResults[Math.min(call, rpcResults.length - 1)]
    call += 1
    return result
  })
  const maybeSingle = vi.fn(async () => ({ data: row, error: null }))
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return {
    supabase: { rpc, from } as unknown as SupabaseClient,
    rpc,
    from,
    select,
    eq,
  }
}

describe("loadOwnProfile", () => {
  it("retombe sur les colonnes accordées si profile_self est refusé (42501)", async () => {
    const { supabase, rpc, from, select, eq } = mockSupabase(
      [
        {
          data: null,
          error: {
            code: "42501",
            message: "permission denied for table profiles",
            status: 403,
          },
        },
      ],
      {
        id: "user-1",
        full_name: "Awa Konan",
        city: "Bouaké",
        phone: "+2250700000000",
        email: "secret@gwa.ci",
      },
    )

    const loaded = await loadOwnProfile(supabase, user)

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith("profile_self")
    expect(from).toHaveBeenCalledWith("profiles")
    expect(select).toHaveBeenCalledWith(PROFILE_SAFE_COLUMNS)
    expect(eq).toHaveBeenCalledWith("id", "user-1")
    expect(loaded.partial).toBe(true)
    expect(loaded.profile).toMatchObject({
      id: "user-1",
      full_name: "Awa Konan",
      city: "Bouaké",
    })
    expect(loaded.profile).not.toHaveProperty("phone")
    expect(loaded.profile).not.toHaveProperty("email")
  })

  it("reste connecté avec l'identité auth si aucun profil n'est lisible", async () => {
    const { supabase, rpc, from } = mockSupabase([{ data: null, error: null }], null)

    const loaded = await loadOwnProfile(supabase, user)

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith("profiles")
    expect(loaded.partial).toBe(true)
    expect(loaded.profile).toMatchObject({
      id: "user-1",
      full_name: "Utilisateur GWA",
      avatar_url: null,
      is_verified: false,
    })
    expect(loaded.profile).not.toHaveProperty("email")
  })

  it("retente une fois sur timeout, puis lit la ligne sans email ni téléphone", async () => {
    vi.useFakeTimers()
    try {
      const { supabase, rpc, from } = mockSupabase(
        [
          { data: null, error: { message: "Request timed out", status: 504 } },
          {
            data: {
              id: "user-1",
              full_name: "Awa Konan",
              phone: "+2250700000000",
              email: "secret@gwa.ci",
              linked_email: "secret@gwa.ci",
              phone_verified: true,
            },
            error: null,
          },
        ],
        null,
      )

      const pending = loadOwnProfile(supabase, user)
      await vi.runAllTimersAsync()
      const loaded = await pending

      expect(rpc).toHaveBeenCalledTimes(2)
      expect(from).not.toHaveBeenCalled()
      expect(loaded.partial).toBe(false)
      expect(loaded.profile.full_name).toBe("Awa Konan")
      expect(loaded.profile).not.toHaveProperty("phone")
      expect(loaded.profile).not.toHaveProperty("email")
      expect(loaded.profile).not.toHaveProperty("linked_email")
      expect(loaded.profile).not.toHaveProperty("phone_verified")
    } finally {
      vi.useRealTimers()
    }
  })

  it("ne retente pas au-delà d'une fois si le timeout persiste", async () => {
    vi.useFakeTimers()
    try {
      const { supabase, rpc, from } = mockSupabase(
        [
          { data: null, error: { message: "timeout", status: 504 } },
          { data: null, error: { message: "timeout", status: 504 } },
          { data: null, error: { message: "timeout", status: 504 } },
        ],
        { id: "user-1", full_name: "Awa Konan" },
      )

      const pending = loadOwnProfile(supabase, user)
      await vi.runAllTimersAsync()
      const loaded = await pending

      expect(rpc).toHaveBeenCalledTimes(2)
      expect(from).toHaveBeenCalledTimes(1)
      expect(loaded.partial).toBe(true)
      expect(loaded.profile.full_name).toBe("Awa Konan")
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("toDisplayedProfile", () => {
  it("n'envoie à /profil que les champs affichés", () => {
    const view = toDisplayedProfile(
      profileFromRow(
        {
          full_name: "Awa Konan",
          city: "Bouaké",
          rating: 4.5,
          email: "secret@gwa.ci",
          phone: "+2250700000000",
          linked_email: "secret@gwa.ci",
          phone_verified: true,
        },
        user,
      ),
    )

    expect(Object.keys(view).sort()).toEqual(
      [
        "avatar_url",
        "bio",
        "city",
        "country",
        "full_name",
        "id",
        "is_verified",
        "user_type",
      ].sort(),
    )
    expect(view).not.toHaveProperty("email")
    expect(view).not.toHaveProperty("phone")
    expect(view).not.toHaveProperty("linked_email")
    expect(view).not.toHaveProperty("phone_verified")
    expect(view).not.toHaveProperty("rating")
    expect(JSON.stringify(view)).not.toContain("secret@gwa.ci")
    expect(JSON.stringify(view)).not.toContain("+225")
  })
})
