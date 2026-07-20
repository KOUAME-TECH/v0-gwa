import "server-only"
import { readFileSync } from "fs"
import { join } from "path"
import { createPool, postgresConnectionString } from "@vercel/postgres"
import pg from "pg"
import { getPostgresConnectionString } from "@/lib/db/migration-039"

export type Migration040Status = {
  applied: boolean
  profilesDigest: boolean
  productsAudioLang: boolean
  postgresConfigured: boolean
}

const STATUS_QUERY = `
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      (table_name = 'profiles' AND column_name IN ('digest_enabled', 'digest_last_sent_at'))
      OR (table_name = 'products' AND column_name = 'audio_lang')
    )
`

function parseStatus(rows: { table_name: string; column_name: string }[]): Migration040Status {
  const profileCols = new Set(
    rows.filter((r) => r.table_name === "profiles").map((r) => r.column_name),
  )
  const productCols = new Set(
    rows.filter((r) => r.table_name === "products").map((r) => r.column_name),
  )
  const profilesDigest =
    profileCols.has("digest_enabled") && profileCols.has("digest_last_sent_at")
  const productsAudioLang = productCols.has("audio_lang")
  return {
    applied: profilesDigest && productsAudioLang,
    profilesDigest,
    productsAudioLang,
    postgresConfigured: true,
  }
}

async function runWithVercelPostgres<T>(fn: (query: (text: string) => Promise<unknown>) => Promise<T>): Promise<T> {
  const pool = createPool()
  try {
    return await fn((text) => pool.query(text))
  } finally {
    await pool.end()
  }
}

async function runWithPg<T>(connectionString: string, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
  const client = new pg.Client({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

async function runDb<T>(
  fn: (query: (text: string) => Promise<{ rows: { table_name: string; column_name: string }[] }>) => Promise<T>,
): Promise<T> {
  const onVercel = !!process.env.VERCEL
  const connectionString = getPostgresConnectionString()

  if (!connectionString) {
    throw new Error("POSTGRES_URL_NON_POOLING / POSTGRES_URL / DATABASE_URL manquant")
  }

  if (onVercel) {
    return runWithVercelPostgres(async (query) => {
      return fn(async (text) => {
        const result = await query(text)
        return result as { rows: { table_name: string; column_name: string }[] }
      })
    })
  }

  return runWithPg(connectionString, async (client) => {
    return fn(async (text) => client.query(text))
  })
}

export async function checkMigration040Status(): Promise<Migration040Status> {
  const postgresConfigured = !!getPostgresConnectionString()
  if (!postgresConfigured) {
    return { applied: false, profilesDigest: false, productsAudioLang: false, postgresConfigured: false }
  }

  try {
    return await runDb(async (query) => {
      const { rows } = await query(STATUS_QUERY)
      return parseStatus(rows)
    })
  } catch (err) {
    console.error("[migration-040] check failed:", err)
    return { applied: false, profilesDigest: false, productsAudioLang: false, postgresConfigured: true }
  }
}

export async function applyMigration040(): Promise<void> {
  const sqlPath = join(process.cwd(), "scripts/schema/040_harmattan_digest.sql")
  const raw = readFileSync(sqlPath, "utf8")
  const statements = raw
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean)

  await runDb(async (query) => {
    for (const statement of statements) {
      await query(statement)
    }
    return undefined
  })
}
