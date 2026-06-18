import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || null
}

async function getAuthenticatedUser(req) {
  const token = getBearerToken(req)
  if (!token) return { user: null, error: 'Missing authorization token' }
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return { user: null, error: 'Invalid or expired token' }
  return { user: data.user, error: null }
}

function toSnake(key) { return key.replace(/([A-Z])/g, '_$1').toLowerCase() }
function rowToSnake(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  return Object.fromEntries(Object.entries(obj).filter(([,v]) => v !== undefined).map(([k,v]) => [toSnake(k), v]))
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return res.status(200).json({ ok: true, note: 'Supabase not configured' })

  const { user, error: authError } = await getAuthenticatedUser(req)
  if (authError) return res.status(401).json({ error: authError })

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
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
