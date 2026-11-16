import { createClient } from "@supabase/supabase-js"
import { readFileSync, appendFileSync } from "fs"

function loadEnv() {
  const raw = readFileSync(".env.local", "utf8")
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue
    const i = line.indexOf("=")
    if (i < 0) continue
    let v = line.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    v = v.replace(/\\r\\n$/g, "").replace(/[\r\n]+$/g, "")
    out[line.slice(0, i).trim()] = v
  }
  return out
}

const env = loadEnv()
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

function log(o) {
  appendFileSync(
    "debug-d90786.log",
    JSON.stringify({ sessionId: "d90786", runId: "auth-smoke", timestamp: Date.now(), ...o }) +
      "\n",
  )
}

function credential(name) {
  return (process.env[name] || env[name] || "").trim()
}

const email = credential("E2E_EMAIL")
const password = credential("E2E_PASSWORD")
if (!email || !password) {
  console.error(
    "E2E_EMAIL et E2E_PASSWORD sont requis. Définissez-les dans l'environnement ou dans .env.local. Le mot de passe n'est jamais journalisé.",
  )
  process.exit(1)
}

function redactSecrets(message) {
  return String(message ?? "").split(password).join("[redacted]")
}

const { data, error } = await sb.auth.signInWithPassword({
  email,
  password,
})

if (error) {
  const err = redactSecrets(error.message).slice(0, 100)
  log({
    hypothesisId: "H5",
    location: "auth-smoke",
    message: "login_fail",
    data: { err },
  })
  console.log("login_fail", err)
  process.exit(0)
}

const { data: role, error: re } = await sb
  .from("admin_roles")
  .select("role,is_active")
  .eq("user_id", data.user.id)
  .maybeSingle()

log({
  hypothesisId: "H5",
  location: "auth-smoke",
  message: "admin_roles_after_rls_fix",
  data: {
    role: role?.role || null,
    active: !!role?.is_active,
    err: re?.message || null,
  },
})

console.log(JSON.stringify({ login: "ok", role, err: re?.message || null }))
await sb.auth.signOut()
