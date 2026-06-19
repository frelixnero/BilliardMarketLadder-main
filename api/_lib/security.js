const rateLimitStore = globalThis.__bmlRateLimitStore || new Map()
const webhookIdStore = globalThis.__bmlWebhookIdStore || new Set()

globalThis.__bmlRateLimitStore = rateLimitStore
globalThis.__bmlWebhookIdStore = webhookIdStore

export function getRequestId(req, res) {
  const incoming = req.headers['x-request-id'] || req.headers['X-Request-Id']
  const requestId = typeof incoming === 'string' && incoming.trim() ? incoming : crypto.randomUUID()
  res.setHeader('X-Request-Id', requestId)
  return requestId
}

export function getClientIp(req) {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

export function rateLimit(req, keyPrefix, limit, windowMs) {
  const ip = getClientIp(req)
  const key = `${keyPrefix}:${ip}`
  const now = Date.now()
  const existing = rateLimitStore.get(key)

  if (!existing || now - existing.startedAt >= windowMs) {
    rateLimitStore.set(key, { count: 1, startedAt: now })
    return { allowed: true, retryAfterSec: 0 }
  }

  existing.count += 1
  rateLimitStore.set(key, existing)

  if (existing.count > limit) {
    const retryAfterMs = Math.max(0, windowMs - (now - existing.startedAt))
    return { allowed: false, retryAfterSec: Math.ceil(retryAfterMs / 1000) }
  }

  return { allowed: true, retryAfterSec: 0 }
}

export function getAllowedOrigins() {
  const direct = [
    process.env.APP_BASE_URL,
    process.env.FRONTEND_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ].filter(Boolean)

  const fromCsv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)

  const devOrigins = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173']

  return new Set([...direct, ...fromCsv, ...devOrigins])
}

export function applyCors(req, res, methods) {
  const origin = req.headers.origin
  const allowlist = getAllowedOrigins()

  if (origin) {
    if (allowlist.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    } else {
      return { ok: false, error: 'Origin not allowed' }
    }
  }

  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id')
  return { ok: true }
}

export function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || null
}

export async function getAuthenticatedUser(req, supabase) {
  const token = getBearerToken(req)
  if (!token) return { user: null, error: 'Missing authorization token' }
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return { user: null, error: 'Invalid or expired token' }
  return { user: data.user, error: null }
}

export function getConfiguredOperatorEmails() {
  return new Set(
    (process.env.OPERATOR_EMAILS || '')
      .split(',')
      .map(x => x.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function getUserRole(user) {
  const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : ''
  if (email && getConfiguredOperatorEmails().has(email)) return 'operator'

  const appRole = typeof user?.app_metadata?.role === 'string' ? user.app_metadata.role.trim().toLowerCase() : ''
  if (appRole === 'operator' || appRole === 'player') return appRole

  const userRole = typeof user?.user_metadata?.role === 'string' ? user.user_metadata.role.trim().toLowerCase() : ''
  if (userRole === 'operator' || userRole === 'player') return userRole

  return 'player'
}

export function requireOperatorUser(user) {
  return getUserRole(user) === 'operator'
}

export function requireEnv(vars) {
  const missing = vars.filter(name => !process.env[name])
  if (missing.length) {
    return { ok: false, error: `Missing required environment variables: ${missing.join(', ')}` }
  }
  return { ok: true }
}

export async function isWebhookProcessed(supabase, eventId) {
  if (!eventId) return false

  const { data, error } = await supabase
    .from('webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle()

  if (!error) return Boolean(data)

  // Fallback for environments without webhook_events table.
  return webhookIdStore.has(eventId)
}

export async function markWebhookProcessed(supabase, eventId, eventType) {
  if (!eventId) return

  const { error } = await supabase
    .from('webhook_events')
    .insert({
      event_id: eventId,
      event_type: eventType || 'unknown',
      processed_at: new Date().toISOString(),
    })

  if (error) webhookIdStore.add(eventId)
}

export function errorResponse(res, status, message, requestId) {
  return res.status(status).json({ error: message, requestId })
}
