import "server-only"
import { readFileSync } from "fs"
import { join } from "path"
import { createPool, postgresConnectionString } from "@vercel/postgres"
import pg from "pg"

export function getPostgresConnectionString(): string | null {
  return (
    postgresConnectionString("direct") ||
    postgresConnectionString("pool") ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    null
  )
}

export type Migration039Status = {
  applied: boolean
  postComments: boolean
  reviews: boolean
  postgresConfigured: boolean
}

const STATUS_QUERY = `
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('post_comments', 'reviews')
    AND column_name IN ('comment_type', 'audio_url', 'review_type')
`

function parseStatus(rows: { table_name: string; column_name: string }[]): Migration039Status {
  const postCols = new Set(
    rows.filter((r) => r.table_name === "post_comments").map((r) => r.column_name),
  )
  const reviewCols = new Set(
    rows.filter((r) => r.table_name === "reviews").map((r) => r.column_name),
  )
  const postComments = postCols.has("comment_type") && postCols.has("audio_url")
  const reviews = reviewCols.has("review_type") && reviewCols.has("audio_url")
  return {
    applied: postComments && reviews,
    postComments,
    reviews,
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

/** Vérifie si les colonnes vocales 039 existent. */
export async function checkMigration039Status(): Promise<Migration039Status> {
  const postgresConfigured = !!getPostgresConnectionString()
  if (!postgresConfigured) {
    return { applied: false, postComments: false, reviews: false, postgresConfigured: false }
  }

  try {
    return await runDb(async (query) => {
      const { rows } = await query(STATUS_QUERY)
      return parseStatus(rows)
    })
  } catch (err) {
    console.error("[migration-039] check failed:", err)
    return { applied: false, postComments: false, reviews: false, postgresConfigured: true }
  }
}

/** Applique scripts/schema/039_comment_voice_listen.sql (idempotent). */
export async function applyMigration039(): Promise<void> {
  const sqlPath = join(process.cwd(), "scripts/schema/039_comment_voice_listen.sql")
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
