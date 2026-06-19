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

function toSnake(key) { return key.replace(/([A-Z])/g, '_$1').toLowerCase() }
function rowToSnake(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  return Object.fromEntries(Object.entries(obj).filter(([,v]) => v !== undefined).map(([k,v]) => [toSnake(k), v]))
}
export default async function handler(req, res) {
  const requestId = getRequestId(req, res)
  const cors = applyCors(req, res, 'POST, OPTIONS')
  if (!cors.ok) return errorResponse(res, 403, cors.error, requestId)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed', requestId)
  if (!envCheck.ok || !supabase) return errorResponse(res, 500, envCheck.error, requestId)

  const rl = rateLimit(req, 'sync-state', 60, 60_000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec))
    return errorResponse(res, 429, 'Too many requests', requestId)
  }

  const { user, error: authError } = await getAuthenticatedUser(req, supabase)
  if (authError) return errorResponse(res, 401, authError, requestId)
  if (!requireOperatorUser(user)) return errorResponse(res, 403, 'Only operators can sync dashboard state', requestId)

  const { players, teams, matches, shares, payments, season, currentRound, s1Priority, settings } = req.body
  try {
    if (teams?.length)    { const { error } = await supabase.from('teams').upsert(teams.map(rowToSnake),    { onConflict: 'id' }); if (error) console.error('teams:', error.message) }
    if (players?.length)  { const { error } = await supabase.from('players').upsert(players.map(rowToSnake),  { onConflict: 'id' }); if (error) console.error('players:', error.message) }
    if (matches?.length)  { const { error } = await supabase.from('matches').upsert(matches.map(rowToSnake),  { onConflict: 'id' }); if (error) console.error('matches:', error.message) }
    if (shares?.length)   { const { error } = await supabase.from('shares').upsert(shares.map(rowToSnake),   { onConflict: 'id' }); if (error) console.error('shares:', error.message) }
    if (payments?.length) { const { error } = await supabase.from('payments').upsert(payments.map(rowToSnake),{ onConflict: 'id' }); if (error) console.error('payments:', error.message) }

    const { data: currentState } = await supabase
      .from('app_state')
      .select('settings')
      .eq('id', 1)
      .maybeSingle()

    const currentSettings = currentState?.settings && typeof currentState.settings === 'object'
      ? currentState.settings
      : {}
    const userDashboards = currentSettings.userDashboards && typeof currentSettings.userDashboards === 'object'
      ? currentSettings.userDashboards
      : {}

    userDashboards[user.id] = {
      dashboard: settings?.dashboard ?? null,
      updatedBy: user.email || user.id,
      updatedAt: new Date().toISOString(),
    }

    const mergedSettings = {
      ...currentSettings,
      userDashboards,
    }

    await supabase.from('app_state').upsert({ id: 1, season: season ?? 1, current_round: currentRound ?? 1, s1_priority: s1Priority ?? false, settings: mergedSettings, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    return res.status(200).json({ ok: true, requestId })
  } catch (err) {
    return errorResponse(res, 500, err.message || 'Cloud sync failed', requestId)
  }
}
