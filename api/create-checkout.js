import Stripe from 'stripe'
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

const envCheck = requireEnv(['STRIPE_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
const stripe = envCheck.ok ? new Stripe(process.env.STRIPE_SECRET_KEY) : null
const supabase = envCheck.ok
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null

const PRICE_IDS = {
  registration:   process.env.STRIPE_PRICE_REGISTRATION   || 'price_1TgnwEA99FsxroMnnSLWi5w5',
  weekly_dues:    process.env.STRIPE_PRICE_WEEKLY_DUES    || 'price_1TgnwKA99FsxroMnsezXA5nW',
  share_top2:     process.env.STRIPE_PRICE_SHARE_TOP2     || 'price_1ThntRA99FsxroMnU69Y2vaH',
  share_top34:    process.env.STRIPE_PRICE_SHARE_TOP34    || 'price_1TiMVnA99FsxroMnbQpvSIVS',
  share_top58:    process.env.STRIPE_PRICE_SHARE_TOP58    || 'price_1TggiiA99FsxroMnpYAcLcrf',
  share_unranked: process.env.STRIPE_PRICE_SHARE_UNRANKED || 'price_1TggihA99FsxroMnBPTlNsqG',
}
export default async function handler(req, res) {
  const requestId = getRequestId(req, res)
  const cors = applyCors(req, res, 'POST, OPTIONS')
  if (!cors.ok) return errorResponse(res, 403, cors.error, requestId)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed', requestId)
  if (!envCheck.ok || !stripe || !supabase) return errorResponse(res, 500, envCheck.error, requestId)

  const rl = rateLimit(req, 'create-checkout', 30, 60_000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec))
    return errorResponse(res, 429, 'Too many checkout requests', requestId)
  }

  const { user, error: authError } = await getAuthenticatedUser(req, supabase)
  if (authError) return errorResponse(res, 401, authError, requestId)

  const { type, playerId, playerName, playerRank, shareTier, buyerName, buyerEmail, season } = req.body
  if (!type) return errorResponse(res, 400, 'Missing type', requestId)

  const origin = req.headers.origin || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  let priceId
  let metadata = { season: String(season || 1) }
  const finalBuyerEmail = buyerEmail || user.email || ''

  if (type === 'registration') {
    if (!requireOperatorUser(user)) return errorResponse(res, 403, 'Only operators can create registration payments', requestId)
    priceId  = PRICE_IDS.registration
    metadata = { ...metadata, type: 'registration', playerId: playerId || '', playerName: playerName || '' }
  } else if (type === 'weekly_dues') {
    if (!requireOperatorUser(user)) return errorResponse(res, 403, 'Only operators can create weekly dues payments', requestId)
    priceId  = PRICE_IDS.weekly_dues
    metadata = { ...metadata, type: 'weekly_dues', playerId: playerId || '', playerName: playerName || '' }
  } else if (type === 'share') {
    if (!shareTier) return errorResponse(res, 400, 'shareTier required', requestId)
    priceId = PRICE_IDS[`share_${shareTier}`]
    if (!priceId) return errorResponse(res, 400, `Unknown share tier: ${shareTier}`, requestId)
    metadata = { ...metadata, type: 'share', playerId: playerId || '', playerName: playerName || '', playerRank: String(playerRank || ''), shareTier, buyerName: buyerName || '', buyerEmail: finalBuyerEmail }
  } else {
    return errorResponse(res, 400, `Unknown type: ${type}`, requestId)
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/?payment=cancelled`,
      customer_email: finalBuyerEmail || undefined,
      metadata,
    })
    return res.status(200).json({ url: session.url, requestId })
  } catch (err) {
    return errorResponse(res, 500, err.message || 'Checkout launch failed', requestId)
  }
}
