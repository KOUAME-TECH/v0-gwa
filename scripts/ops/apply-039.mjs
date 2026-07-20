#!/usr/bin/env node
/**
 * Applique la migration 039 en local ou CI si DATABASE_URL / POSTGRES_URL est défini.
 * Usage: POSTGRES_URL_NON_POOLING="postgresql://..." node scripts/ops/apply-039.mjs
 */
import pg from "pg"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL

if (!connectionString) {
  console.error("❌ Définir POSTGRES_URL_NON_POOLING ou DATABASE_URL")
  process.exit(1)
}

const sql = readFileSync(join(__dirname, "../schema/039_comment_voice_listen.sql"), "utf8")
const statements = sql
  .split(";")
  .map((s) =>
    s
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter(Boolean)

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log("→ Application migration 039…")
  for (const statement of statements) {
    await client.query(statement)
  }
  const { rows } = await client.query(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('post_comments','reviews')
      AND column_name IN ('comment_type','audio_url','review_type')
    ORDER BY 1, 2
  `)
  console.log("✅ Migration 039 appliquée")
  console.table(rows)
} catch (err) {
  console.error("❌ Échec:", err.message)
  process.exit(1)
} finally {
  await client.end()
}
