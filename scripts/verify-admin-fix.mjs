/**
 * Runtime verification: admin APIs idempotence + RLS bypass via service role
 * Mirrors what /api/admin/* does (without cookies).
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, appendFileSync, writeFileSync } from "fs"

function loadEnv() {
  const out = {}
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue
    const i = line.indexOf("=")
    if (i < 0) continue
    let v = line.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1)
    v = v.replace(/\\r\\n$/g, "").replace(/[\r\n]+$/g, "")
    out[line.slice(0, i).trim()] = v
  }
  return out
}

function log(o) {
  appendFileSync(
    "debug-d90786.log",
    JSON.stringify({
      sessionId: "d90786",
      runId: "post-fix-verify",
      timestamp: Date.now(),
      ...o,
    }) + "\n",
  )
}

writeFileSync("debug-d90786.log", "", "utf8")
const env = loadEnv()
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// 1) Orders list (would be empty under anon RLS for admin)
const { data: orders, error: oErr, count } = await admin
  .from("orders")
  .select("id, status, order_number", { count: "exact" })
  .limit(5)

log({
  hypothesisId: "A",
  location: "verify:orders_list",
  message: oErr ? "fail" : "ok",
  data: { count: count ?? orders?.length ?? 0, err: oErr?.message || null },
})

// 2) Idempotent order status: set status twice
let orderId = orders?.[0]?.id
let status1 = null
let status2 = null
if (orderId) {
  const current = orders[0].status
  const target = current === "confirmed" ? "processing" : "confirmed"
  const { data: u1 } = await admin
    .from("orders")
    .update({ status: target, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("id, status")
    .single()
  status1 = u1?.status
  // second update same status = idempotent outcome
  const { data: u2 } = await admin
    .from("orders")
    .update({ status: target, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("id, status")
    .single()
  status2 = u2?.status
  // restore
  await admin.from("orders").update({ status: current }).eq("id", orderId)
}

log({
  hypothesisId: "A",
  location: "verify:orders_idempotent",
  message: status1 && status1 === status2 ? "ok" : "skip_or_fail",
  data: { orderId: orderId ? orderId.slice(0, 8) : null, status1, status2 },
})

// 3) Reports list
const { data: reports, error: rErr } = await admin
  .from("reports")
  .select("id, status")
  .limit(5)
log({
  hypothesisId: "A",
  location: "verify:reports_list",
  message: rErr ? "fail" : "ok",
  data: { n: reports?.length ?? 0, err: rErr?.message || null },
})

// 4) Products moderation idempotent path
const { data: products } = await admin
  .from("products")
  .select("id, moderation_status")
  .limit(3)
const prod = products?.[0]
if (prod) {
  const mod = prod.moderation_status
  const already = mod === "approved"
  log({
    hypothesisId: "A",
    location: "verify:product_idempotent_check",
    message: "ok",
    data: {
      productPrefix: prod.id.slice(0, 8),
      moderation_status: mod,
      wouldBeIdempotentApprove: already,
    },
  })
}

// 5) Auth login + admin_roles client read (session / super_admin)
const anon = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)
const { data: authData, error: authErr } = await anon.auth.signInWithPassword({
  email: "kouamecorporation@gmail.com",
  password: "GwaLocal!WUrNIevV",
})
if (authErr) {
  log({
    hypothesisId: "E",
    location: "verify:login",
    message: "login_fail",
    data: { err: authErr.message.slice(0, 100) },
  })
} else {
  const { data: role, error: roleErr } = await anon
    .from("admin_roles")
    .select("role, is_active")
    .eq("user_id", authData.user.id)
    .maybeSingle()
  log({
    hypothesisId: "E",
    location: "verify:login",
    message: "login_ok",
    data: {
      role: role?.role || null,
      active: !!role?.is_active,
      roleErr: roleErr?.message || null,
    },
  })

  // Chat: can select conversations as this user
  const { data: convs, error: cErr } = await anon
    .from("conversations")
    .select("id")
    .or(
      `participant_1.eq.${authData.user.id},participant_2.eq.${authData.user.id}`,
    )
    .limit(5)
  log({
    hypothesisId: "E",
    location: "verify:chat_list",
    message: cErr ? "fail" : "ok",
    data: { n: convs?.length ?? 0, err: cErr?.message || null },
  })
  await anon.auth.signOut()
}

// 6) HTTP routes exist
for (const path of [
  "/api/admin/orders",
  "/api/admin/stats",
  "/api/admin/reports",
  "/api/auth/admin-status",
]) {
  const res = await fetch(`http://127.0.0.1:3000${path}`)
  log({
    hypothesisId: "A",
    location: `verify:http${path}`,
    message: res.status === 401 ? "auth_required_ok" : `status_${res.status}`,
    data: { status: res.status },
  })
}

console.log("verify done — see debug-d90786.log")
