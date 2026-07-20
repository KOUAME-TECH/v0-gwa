import "server-only"
import { readFileSync } from "fs"
import { join } from "path"
import pg from "pg"

const { Client } = pg

export function getPostgresConnectionString(): string | null {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    null
  )
}

function normalizeConnectionString(raw: string): string {
  if (raw.includes("localhost") || raw.includes("127.0.0.1")) return raw
  if (/[?&]sslmode=/i.test(raw)) return raw
  return `${raw}${raw.includes("?") ? "&" : "?"}sslmode=no-verify`
}

function createPgClient(connectionString: string): pg.Client {
  const normalized = normalizeConnectionString(connectionString)
  const isLocal = normalized.includes("localhost") || normalized.includes("127.0.0.1")
  return new Client({
    connectionString: normalized,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  })
}

export async function withPostgresClient<T>(
  fn: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const connectionString = getPostgresConnectionString()
  if (!connectionString) {
    throw new Error("POSTGRES_URL_NON_POOLING / POSTGRES_URL / DATABASE_URL manquant sur le serveur")
  }

  const client = createPgClient(connectionString)
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

export type Migration039Status = {
  applied: boolean
  postComments: boolean
  reviews: boolean
  postgresConfigured: boolean
}

/** Vérifie si les colonnes vocales 039 existent. */
export async function checkMigration039Status(): Promise<Migration039Status> {
  const postgresConfigured = !!getPostgresConnectionString()

  if (!postgresConfigured) {
    return { applied: false, postComments: false, reviews: false, postgresConfigured: false }
  }

  return withPostgresClient(async (client) => {
    const { rows } = await client.query<{ table_name: string; column_name: string }>(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('post_comments', 'reviews')
        AND column_name IN ('comment_type', 'audio_url', 'review_type')
    `)

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
  })
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

  await withPostgresClient(async (client) => {
    for (const statement of statements) {
      await client.query(statement)
    }
  })
}
