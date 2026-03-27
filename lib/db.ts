import { Pool } from 'pg'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    pool = new Pool({
      connectionString: url,
      // Replit PostgreSQL uses a self-signed cert; rejectUnauthorized: false is required
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    })
  }
  return pool
}

export async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  values?: unknown[]
): Promise<T[]> {
  const result = await getPool().query(sql, values)
  return result.rows as T[]
}

export async function initBrandContextTable(): Promise<void> {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS brand_context (
      id         TEXT        PRIMARY KEY DEFAULT 'default',
      brand_name TEXT        NOT NULL DEFAULT '',
      niche_id   TEXT        NOT NULL DEFAULT '',
      niche_label TEXT       NOT NULL DEFAULT '',
      product_description TEXT NOT NULL DEFAULT '',
      target_audience     TEXT NOT NULL DEFAULT '',
      brand_voice         TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}
