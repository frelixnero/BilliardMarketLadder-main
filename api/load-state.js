import { createClient } from '@supabase/supabase-js'

const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = hasDb ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY) : null

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (!supabase) return res.status(200).json({ dashboard: null, note: 'Supabase not configured' })

  const { user, error: authError } = await getAuthenticatedUser(req)
  if (authError) return res.status(401).json({ error: authError })

  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('settings, updated_at')
      .eq('id', 1)
      .single()

    if (error) throw error

    const userState = data?.settings?.userDashboards?.[user.id] || null

    return res.status(200).json({
      dashboard: userState?.dashboard || null,
      updatedAt: userState?.updatedAt || data?.updated_at || null,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
