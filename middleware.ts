import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

// Security: Threat detection patterns
const THREAT_PATTERNS = [
  /(\.\.|%2e%2e|%252e)/i,
  /(union\s+select|drop\s+table|insert\s+into)/i,
  /(<script|javascript:|data:text\/html)/i,
  /(\/etc\/passwd|\/proc\/self)/i,
]

const MALICIOUS_UA = ['sqlmap', 'nikto', 'nmap', 'masscan', 'zgrab', 'dirbuster', 'gobuster']

// Security: Rate limiting (in-memory)
const RL_MAP = new Map<string, { count: number; ts: number }>()
const RL_LIMITS: Record<string, number> = {
  auth: 10,
  admin: 20,
  api: 60,
  default: 120,
}

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1'
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getClientIP(request)

  // Layer 1: Threat detection
  try {
    const url = decodeURIComponent(request.url)
    const ua = (request.headers.get('user-agent') || '').toLowerCase()
    if (MALICIOUS_UA.some(b => ua.includes(b)) || THREAT_PATTERNS.some(p => p.test(url))) {
      return new NextResponse('Forbidden', { status: 403 })
    }
  } catch { /* malformed URL */ }

  // Layer 2: Rate limiting (admin plus strict que API générale)
  const rlKey = pathname.startsWith('/auth')
    ? 'auth'
    : pathname.startsWith('/api/admin')
      ? 'admin'
      : pathname.startsWith('/api')
        ? 'api'
        : 'default'
  const limit = RL_LIMITS[rlKey]
  const mapKey = `${ip}:${rlKey}`
  const now = Date.now()
  const entry = RL_MAP.get(mapKey)
  if (entry && now - entry.ts < 60_000) {
    entry.count++
    if (entry.count > limit) {
      return NextResponse.json(
        { error: 'Trop de requetes. Reessayez dans 1 minute.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  } else {
    RL_MAP.set(mapKey, { count: 1, ts: now })
  }

  // Continue with existing auth session logic
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
