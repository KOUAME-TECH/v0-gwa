/**
 * Lot C / 078 : plus aucune policy UPDATE sur public.messages.
 * Le client ne doit plus faire d'UPDATE direct sur messages (il serait
 * silencieusement refusé par RLS) : uniquement mark_messages_read et
 * respond_to_price_offer.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const root = path.resolve(__dirname, "..")
const SCAN = ["app", "components", "lib", "hooks"]

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    if (e === "node_modules" || e.startsWith(".")) continue
    const p = path.join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e)) out.push(p)
  }
  return out
}

describe("messages : pas d'UPDATE direct côté client", () => {
  it("aucun .from(\"messages\").update(...) dans le code applicatif", () => {
    const offenders: string[] = []
    for (const d of SCAN) {
      for (const f of walk(path.join(root, d))) {
        const src = readFileSync(f, "utf8")
        if (/\.from\(\s*["'`]messages["'`]\s*\)\s*\.update\s*\(/.test(src)) {
          offenders.push(path.relative(root, f))
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("le chat passe par les RPC 078", () => {
    const src = readFileSync(path.join(root, "components/chat/chat-conversation.tsx"), "utf8")
    expect(src).toMatch(/rpc\(\s*"mark_messages_read"/)
    expect(src).toMatch(/rpc\(\s*"respond_to_price_offer"/)
  })
})

describe("078 : aucune policy UPDATE sur messages", () => {
  const sql = readFileSync(path.join(root, "scripts/schema/078_security_modules.sql"), "utf8")
  const rb = readFileSync(path.join(root, "scripts/schema/078_security_modules.rollback.sql"), "utf8")

  it("ne crée aucune policy FOR UPDATE sur public.messages", () => {
    expect(sql).not.toMatch(/CREATE\s+POLICY[^;]*ON\s+public\.messages[^;]*FOR\s+UPDATE/i)
    expect(sql).toMatch(/DROP POLICY IF EXISTS "messages_update_participant" ON public\.messages/)
    expect(sql).toMatch(/DROP POLICY IF EXISTS "messages_update_own_unread" ON public\.messages/)
  })

  it("RPC SECURITY DEFINER avec search_path fixé, sans EXECUTE pour anon", () => {
    for (const fn of ["mark_messages_read(uuid)", "respond_to_price_offer(uuid, text)"]) {
      const name = fn.split("(")[0]
      const block = sql.slice(sql.indexOf(`FUNCTION public.${name}(`))
      expect(block.slice(0, 400)).toMatch(/SECURITY DEFINER\s+SET search_path = public/)
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon;`)
    }
  })

  it("pas de 082 et rollback en ROLLBACK par défaut", () => {
    expect(sql).not.toMatch(/082/)
    expect(rb).toMatch(/DROP FUNCTION IF EXISTS public\.respond_to_price_offer\(uuid, text\);/)
    expect(rb.trim().split("\n").pop()).toMatch(/^ROLLBACK;/)
  })
})
