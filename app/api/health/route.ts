import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  let dbStatus = 'unknown'
  try {
    const supabase = await createClient()
    await supabase.from('profiles').select('id').limit(1)
    dbStatus = 'connected'
  } catch {
    dbStatus = 'error'
  }
  const healthy = dbStatus === 'connected'
  return NextResponse.json({
    status: healthy ? 'healthy' : 'degraded',
    app: 'GWA Platform',
    tagline: 'Marche - langue Anoh, Cote d\'Ivoire',
    version: '2.0.0',
    ts: new Date().toISOString(),
    env: process.env.NODE_ENV,
    db: dbStatus,
  }, { status: healthy ? 200 : 503 })
}
