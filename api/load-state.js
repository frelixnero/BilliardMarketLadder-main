import { createClient } from '@supabase/supabase-js'
import {
  applyCors,
  errorResponse,
  getAuthenticatedUser,
  getRequestId,
  rateLimit,
  requireOperatorUser,
  requireEnv,
} from './_lib/security.js'

const envCheck = requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
const supabase = envCheck.ok
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null

export default async function handler(req, res) {
  const requestId = getRequestId(req, res)
  const cors = applyCors(req, res, 'GET, OPTIONS')
  if (!cors.ok) return errorResponse(res, 403, cors.error, requestId)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return errorResponse(res, 405, 'Method not allowed', requestId)

  if (!envCheck.ok || !supabase) return errorResponse(res, 500, envCheck.error, requestId)

  const rl = rateLimit(req, 'load-state', 120, 60_000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec))
    return errorResponse(res, 429, 'Too many requests', requestId)
  }

  const { user, error: authError } = await getAuthenticatedUser(req, supabase)
  if (authError) return errorResponse(res, 401, authError, requestId)

  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('settings, updated_at')
      .eq('id', 1)
      .single()

    if (error) throw error

    const role = getUserRole(user)
    let userState = null
    if (role === 'operator') {
      userState = data?.settings?.userDashboards?.[user.id] || null
    } else {
      const dashboards = Object.values(data?.settings?.userDashboards || {})
      if (dashboards.length > 0) {
        dashboards.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        userState = dashboards[0]
      }
    }

    return res.status(200).json({
      dashboard: userState?.dashboard || null,
      updatedAt: userState?.updatedAt || data?.updated_at || null,
      requestId,
    })
  } catch (err) {
    return errorResponse(res, 500, err.message || 'Cloud load failed', requestId)
  }
}
