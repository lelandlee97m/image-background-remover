export interface Env {
  REMOVE_BG_API_KEY: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  OAUTH_REDIRECT_URI: string
  PAYPAL_CLIENT_ID: string
  PAYPAL_CLIENT_SECRET: string
  PAYPAL_WEBHOOK_ID?: string
  PAYPAL_MODE?: string // 'sandbox' | 'live', defaults to 'sandbox'
  DB: D1Database
}

interface GoogleUser {
  sub: string
  email: string
  name: string
  picture: string
}

interface Session {
  id: string
  google_id: string
  email: string
  name: string
  picture: string
  expires_at: string
}

interface UserInfo {
  id: string
  google_id: string
  email: string
  name: string
  tier: string
}

function generateId(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

function generateSessionToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

function corsHeaders(origin: string): Record<string, string> {
  // When credentials: 'include' is used, Origin must be a specific domain, not '*'
  // Browsers reject cookies if Access-Control-Allow-Origin is wildcard
  return {
    'Access-Control-Allow-Origin': origin || 'https://imagebackgroundremover88ic.shop',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

async function getSession(request: Request, env: Env): Promise<{ session: Session | null; origin: string }> {
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(/session=([^;]+)/)
  const sessionId = match?.[1]
  const origin = request.headers.get('Origin') || ''

  if (!sessionId) return { session: null, origin }

  const session = await env.DB
    .prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")')
    .bind(sessionId)
    .first<Session>()

  return { session: session || null, origin }
}

async function getUser(request: Request, env: Env): Promise<{ user: UserInfo | null; origin: string }> {
  const { session, origin } = await getSession(request, env)
  if (!session) return { user: null, origin }

  const user = await env.DB
    .prepare('SELECT * FROM users WHERE google_id = ?')
    .bind(session.google_id)
    .first<UserInfo>()

  return { user: user || null, origin }
}

// ─── Ensure user exists in users table ────────────────────────

async function ensureUser(env: Env, session: Session): Promise<UserInfo> {
  const existing = await env.DB
    .prepare('SELECT * FROM users WHERE google_id = ?')
    .bind(session.google_id)
    .first<UserInfo>()

  if (existing) return existing

  const userId = generateId()
  await env.DB.prepare(
    'INSERT INTO users (id, google_id, email, name, tier) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(userId, session.google_id, session.email, session.name, 'free')
    .run()

  return { id: userId, google_id: session.google_id, email: session.email, name: session.name, tier: 'free' }
}

// ─── OAuth Routes ─────────────────────────────────────────────

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const redirectUri = env.OAUTH_REDIRECT_URI || `${url.protocol}//${url.host}/api/auth/callback`

  const frontendUrl =
    request.headers.get('Referer') ||
    url.searchParams.get('redirect') ||
    `${url.protocol}//${url.host}`

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleAuthUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID)
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri)
  googleAuthUrl.searchParams.set('response_type', 'code')
  googleAuthUrl.searchParams.set('scope', 'openid email profile')
  googleAuthUrl.searchParams.set('access_type', 'offline')
  googleAuthUrl.searchParams.set('prompt', 'consent')
  googleAuthUrl.searchParams.set('state', encodeURIComponent(frontendUrl))

  return Response.redirect(googleAuthUrl.toString(), 302)
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    return new Response(`Google OAuth error: ${error}`, { status: 400 })
  }

  if (!code) {
    return new Response('Missing authorization code', { status: 400 })
  }

  const redirectUri = env.OAUTH_REDIRECT_URI || `${url.protocol}//${url.host}/api/auth/callback`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error('Token exchange failed:', errText)
    return new Response('Failed to exchange authorization code', { status: 502 })
  }

  const tokens = await tokenRes.json<{ id_token: string }>()

  const base64 = tokens.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const payload: GoogleUser = JSON.parse(atob(base64))

  const sessionId = generateSessionToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await env.DB.prepare(
    'INSERT INTO sessions (id, google_id, email, name, picture, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(sessionId, payload.sub, payload.email, payload.name, payload.picture, expiresAt)
    .run()

  // Ensure user exists in users table
  await ensureUser(env, {
    id: sessionId,
    google_id: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    expires_at: expiresAt,
  })

  const frontendUrl = state ? decodeURIComponent(state) : `${url.protocol}//${url.host}`

  return new Response(null, {
    status: 302,
    headers: {
      Location: frontendUrl,
      'Set-Cookie': `session=${sessionId}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
    },
  })
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  const { session, origin } = await getSession(request, env)

  if (!session) {
    return jsonResponse({ user: null }, 200, corsHeaders(origin))
  }

  const user = await env.DB
    .prepare('SELECT * FROM users WHERE google_id = ?')
    .bind(session.google_id)
    .first<UserInfo>()

  return jsonResponse(
    {
      user: user
        ? { id: user.id, email: user.email, name: user.name, tier: user.tier }
        : null,
    },
    200,
    corsHeaders(origin),
  )
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(/session=([^;]+)/)
  const sessionId = match?.[1]
  const origin = request.headers.get('Origin') || ''

  if (sessionId) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
  }

  return jsonResponse(
    { success: true },
    200,
    {
      ...corsHeaders(origin),
      'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0',
    },
  )
}

// ─── Credits API ──────────────────────────────────────────────

// GET /api/credits/balance
async function handleGetBalance(request: Request, env: Env): Promise<Response> {
  const { user, origin } = await getUser(request, env)

  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders(origin))
  }

  const result = await env.DB
    .prepare('SELECT COALESCE(SUM(balance), 0) as total FROM credits WHERE user_id = ?')
    .bind(user.id)
    .first<{ total: number }>()

  return jsonResponse({ balance: result?.total || 0 }, 200, corsHeaders(origin))
}

// POST /api/credits/deduct
async function handleDeductCredit(request: Request, env: Env): Promise<Response> {
  const { user, origin } = await getUser(request, env)

  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders(origin))
  }

  // Paid users (pro) have unlimited credits
  if (user.tier === 'pro') {
    await env.DB.prepare(
      'INSERT INTO usage_log (id, user_id, action, created_at) VALUES (?, ?, ?, datetime("now"))',
    )
      .bind(generateId(), user.id, 'remove_bg')
      .run()
    return jsonResponse({ success: true, balance: -1 }, 200, corsHeaders(origin))
  }

  const total = await env.DB
    .prepare('SELECT COALESCE(SUM(balance), 0) as total FROM credits WHERE user_id = ?')
    .bind(user.id)
    .first<{ total: number }>()

  if (!total || total.total <= 0) {
    return jsonResponse({ error: 'Insufficient credits' }, 402, corsHeaders(origin))
  }

  // Deduct from oldest credit record with balance > 0
  const creditRecord = await env.DB
    .prepare('SELECT id, balance FROM credits WHERE user_id = ? AND balance > 0 ORDER BY created_at ASC LIMIT 1')
    .bind(user.id)
    .first<{ id: string; balance: number }>()

  if (!creditRecord) {
    return jsonResponse({ error: 'Insufficient credits' }, 402, corsHeaders(origin))
  }

  await env.DB.prepare('UPDATE credits SET balance = balance - 1 WHERE id = ?')
    .bind(creditRecord.id)
    .run()

  await env.DB.prepare(
    'INSERT INTO usage_log (id, user_id, action, created_at) VALUES (?, ?, ?, datetime("now"))',
  )
    .bind(generateId(), user.id, 'remove_bg')
    .run()

  const newTotal = total.total - 1
  return jsonResponse({ success: true, balance: newTotal }, 200, corsHeaders(origin))
}

// POST /api/credits/gift-signup
async function handleGiftSignup(request: Request, env: Env): Promise<Response> {
  const { user, origin } = await getUser(request, env)

  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders(origin))
  }

  // Check if already received signup gift
  const existingGift = await env.DB
    .prepare('SELECT id FROM credits WHERE user_id = ? AND source = ?')
    .bind(user.id, 'gift_signup')
    .first()

  if (existingGift) {
    return jsonResponse({ error: 'Signup gift already claimed' }, 409, corsHeaders(origin))
  }

  await env.DB.prepare(
    'INSERT INTO credits (id, user_id, balance, source, pack_type, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
  )
    .bind(generateId(), user.id, 3, 'gift_signup', 'signup_bonus')
    .run()

  return jsonResponse({ success: true, credits: 3 }, 200, corsHeaders(origin))
}

// GET /api/credits/history
async function handleGetHistory(request: Request, env: Env): Promise<Response> {
  const { user, origin } = await getUser(request, env)
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
  const offset = (page - 1) * limit

  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders(origin))
  }

  const [history, countResult] = await Promise.all([
    env.DB
      .prepare(
        'SELECT * FROM usage_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      )
      .bind(user.id, limit, offset)
      .all(),
    env.DB
      .prepare('SELECT COUNT(*) as total FROM usage_log WHERE user_id = ?')
      .bind(user.id)
      .first<{ total: number }>(),
  ])

  return jsonResponse(
    {
      history: history.results || [],
      pagination: {
        page,
        limit,
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / limit),
      },
    },
    200,
    corsHeaders(origin),
  )
}

// ─── Guest Quota API ──────────────────────────────────────────

// GET /api/guest/quota
async function handleGetGuestQuota(request: Request, env: Env): Promise<Response> {
  const fingerprint = request.headers.get('X-Device-Fingerprint')
  const origin = request.headers.get('Origin') || ''

  if (!fingerprint) {
    return jsonResponse({ remaining: 3, total: 3 }, 200, corsHeaders(origin))
  }

  const record = await env.DB
    .prepare('SELECT usage_count FROM guest_usage WHERE device_fingerprint = ?')
    .bind(fingerprint)
    .first<{ usage_count: number }>()

  const used = record?.usage_count || 0
  const remaining = Math.max(0, 3 - used)

  return jsonResponse({ remaining, used, total: 3 }, 200, corsHeaders(origin))
}

// POST /api/guest/track
async function handleTrackGuest(request: Request, env: Env): Promise<Response> {
  const fingerprint = request.headers.get('X-Device-Fingerprint')
  const origin = request.headers.get('Origin') || ''

  if (!fingerprint) {
    return jsonResponse({ error: 'Missing device fingerprint' }, 400, corsHeaders(origin))
  }

  // Upsert guest usage
  const existing = await env.DB
    .prepare('SELECT usage_count FROM guest_usage WHERE device_fingerprint = ?')
    .bind(fingerprint)
    .first<{ usage_count: number }>()

  if (existing) {
    if (existing.usage_count >= 3) {
      return jsonResponse({ error: 'Guest quota exhausted' }, 402, corsHeaders(origin))
    }
    await env.DB.prepare(
      'UPDATE guest_usage SET usage_count = usage_count + 1, last_used = datetime("now") WHERE device_fingerprint = ?',
    )
      .bind(fingerprint)
      .run()
  } else {
    await env.DB.prepare(
      'INSERT INTO guest_usage (device_fingerprint, usage_count, last_used, created_at) VALUES (?, 1, datetime("now"), datetime("now"))',
    )
      .bind(fingerprint)
      .run()
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  await env.DB.prepare(
    'INSERT INTO usage_log (id, device_fingerprint, ip_address, action, created_at) VALUES (?, ?, ?, ?, datetime("now"))',
  )
    .bind(generateId(), fingerprint, ip, 'remove_bg')
    .run()

  const newCount = (existing?.usage_count || 0) + 1
  return jsonResponse({ success: true, remaining: 3 - newCount, used: newCount }, 200, corsHeaders(origin))
}

// ─── Background Removal (updated with credit/quota checks) ────

// ─── PayPal Integration ──────────────────────────────────────

const PAYPAL_BASE_URL = 'https://api-m.sandbox.paypal.com'
const PAYPAL_SDK_URL = 'https://www.sandbox.paypal.com/sdk/js'

const PACKS: Record<string, { credits: number; price: string }> = {
  starter: { credits: 50, price: '2.99' },
  popular: { credits: 200, price: '9.99' },
  value: { credits: 500, price: '19.99' },
  bulk: { credits: 2000, price: '59.99' },
}

const SUBSCRIPTION_PLANS: Record<string, { credits: number; price: string; interval: string; tier: string; name: string }> = {
  proLite: { credits: 100, price: '4.99', interval: 'MONTH', tier: 'pro_lite', name: 'Pro Lite' },
  pro: { credits: 300, price: '9.99', interval: 'MONTH', tier: 'pro', name: 'Pro' },
  proAnnual: { credits: 300, price: '79.00', interval: 'YEAR', tier: 'pro', name: 'Pro Annual' },
}

function getPayPalBaseUrl(env: Env): string {
  return env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : PAYPAL_BASE_URL
}

async function getPayPalAccessToken(env: Env): Promise<string> {
  const baseUrl = getPayPalBaseUrl(env)
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('PayPal token error:', err)
    throw new Error('Failed to get PayPal access token')
  }
  const data = await res.json<{ access_token: string }>()
  return data.access_token
}

// POST /api/paypal/create-order — one-time credit pack purchase
async function handlePayPalCreateOrder(request: Request, env: Env): Promise<Response> {
  const { user, origin } = await getUser(request, env)
  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders(origin))
  }

  let body: { packType?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders(origin))
  }

  const packType = body.packType
  const pack = PACKS[packType]
  if (!pack) {
    return jsonResponse({ error: 'Invalid pack type', validPacks: Object.keys(PACKS) }, 400, corsHeaders(origin))
  }

  try {
    const token = await getPayPalAccessToken(env)
    const baseUrl = getPayPalBaseUrl(env)

    const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: pack.price,
          },
          description: `Image BG Remover — ${packType} Credit Pack (${pack.credits} credits)`,
          custom_id: `${user.id}:${packType}:${pack.credits}`,
        }],
        application_context: {
          brand_name: 'Image Background Remover',
          user_action: 'PAY_NOW',
          return_url: `${origin}/api/paypal/success`,
          cancel_url: `${origin}/api/paypal/cancel`,
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('PayPal create order error:', err)
      return jsonResponse({ error: 'Failed to create PayPal order' }, 502, corsHeaders(origin))
    }

    const order = await res.json<{ id: string; links: Array<{ rel: string; href: string }> }>()

    // Save pending order to DB
    const orderId = generateId()
    await env.DB.prepare(
      'INSERT INTO orders (id, user_id, paypal_order_id, pack_type, credits, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(orderId, user.id, order.id, packType, pack.credits, parseFloat(pack.price), 'pending').run()

    return jsonResponse({ orderId: order.id, dbOrderId: orderId }, 200, corsHeaders(origin))
  } catch (err) {
    console.error('PayPal create order exception:', err)
    return jsonResponse({ error: 'Internal error creating order' }, 500, corsHeaders(origin))
  }
}

// POST /api/paypal/capture-order — capture payment after frontend approval
async function handlePayPalCaptureOrder(request: Request, env: Env): Promise<Response> {
  const { user, origin } = await getUser(request, env)
  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders(origin))
  }

  let body: { paypalOrderId?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders(origin))
  }

  if (!body.paypalOrderId) {
    return jsonResponse({ error: 'Missing paypalOrderId' }, 400, corsHeaders(origin))
  }

  try {
    const token = await getPayPalAccessToken(env)
    const baseUrl = getPayPalBaseUrl(env)

    // Capture the payment
    const res = await fetch(`${baseUrl}/v2/checkout/orders/${body.paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('PayPal capture error:', err)
      return jsonResponse({ error: 'Failed to capture payment' }, 502, corsHeaders(origin))
    }

    const capture = await res.json()

    if (capture.status !== 'COMPLETED') {
      return jsonResponse({ error: 'Payment not completed', status: capture.status }, 400, corsHeaders(origin))
    }

    // Find the order in our DB
    const order = await env.DB
      .prepare('SELECT * FROM orders WHERE paypal_order_id = ? AND user_id = ?')
      .bind(body.paypalOrderId, user.id)
      .first<{ id: string; pack_type: string; credits: number; amount: number }>()

    if (!order) {
      return jsonResponse({ error: 'Order not found' }, 404, corsHeaders(origin))
    }

    // Update order status
    await env.DB.prepare(
      'UPDATE orders SET status = ?, completed_at = datetime("now") WHERE id = ?',
    ).bind('completed', order.id).run()

    // Add credits to user
    await env.DB.prepare(
      'INSERT INTO credits (id, user_id, balance, source, pack_type, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
    ).bind(generateId(), user.id, order.credits, 'purchase', order.pack_type).run()

    // Log usage
    await env.DB.prepare(
      'INSERT INTO usage_log (id, user_id, action, created_at) VALUES (?, ?, ?, datetime("now"))',
    ).bind(generateId(), user.id, `purchase_${order.pack_type}`).run()

    return jsonResponse({ success: true, credits: order.credits, packType: order.pack_type }, 200, corsHeaders(origin))
  } catch (err) {
    console.error('PayPal capture exception:', err)
    return jsonResponse({ error: 'Internal error capturing payment' }, 500, corsHeaders(origin))
  }
}

// POST /api/paypal/create-subscription — create recurring subscription
async function handlePayPalCreateSubscription(request: Request, env: Env): Promise<Response> {
  const { user, origin } = await getUser(request, env)
  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders(origin))
  }

  let body: { plan?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders(origin))
  }

  const planConfig = SUBSCRIPTION_PLANS[body.plan]
  if (!planConfig) {
    return jsonResponse({ error: 'Invalid plan', validPlans: Object.keys(SUBSCRIPTION_PLANS) }, 400, corsHeaders(origin))
  }

  try {
    const token = await getPayPalAccessToken(env)
    const baseUrl = getPayPalBaseUrl(env)

    // Create a PayPal product (idempotent — check if exists first)
    const productListRes = await fetch(`${baseUrl}/v1/catalogs/products?page_size=100`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const productList = await productListRes.json<{ products: Array<{ id: string; name: string }> }>()
    const existingProduct = productList.products?.find(p => p.name === 'Image Background Remover')

    let productId: string
    if (existingProduct) {
      productId = existingProduct.id
    } else {
      const productRes = await fetch(`${baseUrl}/v1/catalogs/products`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Image Background Remover',
          description: 'Background removal subscription plans',
          type: 'SERVICE',
          category: 'SOFTWARE',
        }),
      })
      const product = await productRes.json<{ id: string }>()
      productId = product.id
    }

    // Create a billing plan for this subscription tier
    const planName = `IBR ${planConfig.name} (${planConfig.interval})`
    const planRes = await fetch(`${baseUrl}/v1/billing/plans`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        name: planName,
        description: `${planConfig.credits} credits per ${planConfig.interval.toLowerCase()}`,
        billing_cycles: [{
          frequency: { interval_unit: planConfig.interval, interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // infinite
          pricing_scheme: {
            fixed_price: { value: planConfig.price, currency_code: 'USD' },
          },
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: { value: '0', currency_code: 'USD' },
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3,
        },
      }),
    })

    if (!planRes.ok) {
      const err = await planRes.text()
      console.error('PayPal create plan error:', err)
      return jsonResponse({ error: 'Failed to create billing plan' }, 502, corsHeaders(origin))
    }

    const plan = await planRes.json<{ id: string }>()

    // Activate the plan
    await fetch(`${baseUrl}/v1/billing/plans/${plan.id}/activate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    })

    // Create subscription
    const subRes = await fetch(`${baseUrl}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: plan.id,
        custom_id: `${user.id}:${body.plan}`,
        application_context: {
          brand_name: 'Image Background Remover',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${origin}/api/paypal/success`,
          cancel_url: `${origin}/api/paypal/cancel`,
        },
      }),
    })

    if (!subRes.ok) {
      const err = await subRes.text()
      console.error('PayPal create subscription error:', err)
      return jsonResponse({ error: 'Failed to create subscription' }, 502, corsHeaders(origin))
    }

    const subscription = await subRes.json<{
      id: string
      links: Array<{ rel: string; href: string; method: string }>
    }>()

    // Save pending subscription to DB
    const subId = generateId()
    await env.DB.prepare(
      'INSERT INTO subscriptions (id, user_id, paypal_subscription_id, plan, tier, amount, credits_per_cycle, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(subId, user.id, subscription.id, body.plan, planConfig.tier, parseFloat(planConfig.price), planConfig.credits, 'pending').run()

    // Find the approve link
    const approveLink = subscription.links.find(l => l.rel === 'approve')
    if (!approveLink) {
      return jsonResponse({ error: 'No approval link found' }, 502, corsHeaders(origin))
    }

    return jsonResponse({ subscriptionId: subscription.id, approveLink: approveLink.href }, 200, corsHeaders(origin))
  } catch (err) {
    console.error('PayPal create subscription exception:', err)
    return jsonResponse({ error: 'Internal error creating subscription' }, 500, corsHeaders(origin))
  }
}

// POST /api/paypal/webhook — receive PayPal webhook events
async function handlePayPalWebhook(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json()
    const eventType = body.event_type
    console.log('PayPal webhook:', eventType)

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      // One-time payment captured
      const orderId = body.resource?.id
      const customId = body.resource?.custom_id

      if (orderId && customId) {
        const [userId, packType, credits] = customId.split(':')

        // Update order status
        await env.DB.prepare(
          'UPDATE orders SET status = ?, completed_at = datetime("now") WHERE paypal_order_id = ?',
        ).bind('completed', orderId).run()

        // Add credits
        await env.DB.prepare(
          'INSERT INTO credits (id, user_id, balance, source, pack_type, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
        ).bind(generateId(), userId, parseInt(credits), 'purchase', packType).run()
      }
    }

    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const subId = body.resource?.id
      if (subId) {
        const sub = await env.DB
          .prepare('SELECT * FROM subscriptions WHERE paypal_subscription_id = ?')
          .bind(subId)
          .first<{ id: string; user_id: string; tier: string; plan: string; credits_per_cycle: number }>()

        if (sub) {
          await env.DB.prepare('UPDATE subscriptions SET status = ? WHERE id = ?').bind('active', sub.id).run()
          await env.DB.prepare('UPDATE users SET tier = ? WHERE id = ?').bind(sub.tier, sub.user_id).run()

          // Add initial credits
          await env.DB.prepare(
            'INSERT INTO credits (id, user_id, balance, source, pack_type, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
          ).bind(generateId(), sub.user_id, sub.credits_per_cycle, 'subscription', sub.plan).run()
        }
      }
    }

    if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
      const subId = body.resource?.id
      if (subId) {
        const sub = await env.DB
          .prepare('SELECT * FROM subscriptions WHERE paypal_subscription_id = ?')
          .bind(subId)
          .first<{ id: string; user_id: string }>()

        if (sub) {
          await env.DB.prepare(
            'UPDATE subscriptions SET status = ?, cancelled_at = datetime("now") WHERE id = ?',
          ).bind('cancelled', sub.id).run()
          await env.DB.prepare("UPDATE users SET tier = 'free' WHERE id = ?").bind(sub.user_id).run()
        }
      }
    }

    if (eventType === 'BILLING.SUBSCRIPTION.RENEWED') {
      const subId = body.resource?.id
      if (subId) {
        const sub = await env.DB
          .prepare('SELECT * FROM subscriptions WHERE paypal_subscription_id = ?')
          .bind(subId)
          .first<{ id: string; user_id: string; plan: string; credits_per_cycle: number }>()

        if (sub) {
          // Add credits for new billing cycle
          await env.DB.prepare(
            'INSERT INTO credits (id, user_id, balance, source, pack_type, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
          ).bind(generateId(), sub.user_id, sub.credits_per_cycle, 'subscription', sub.plan).run()
        }
      }
    }

    return jsonResponse({ received: true }, 200)
  } catch (err) {
    console.error('PayPal webhook error:', err)
    return jsonResponse({ error: 'Webhook processing failed' }, 500)
  }
}

// GET /api/paypal/success — frontend redirect after successful payment
async function handlePayPalSuccess(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') // PayPal order ID or subscription ID
  const PayerID = url.searchParams.get('PayerID')
  const subscriptionId = url.searchParams.get('subscription_id')
  const ba_token = url.searchParams.get('ba_token') // billing agreement token (subscription)

  if (subscriptionId || ba_token) {
    // Subscription approval — webhook handles activation + credit grant
    return Response.redirect(`${url.origin}/dashboard?payment=success`, 302)
  }

  if (token && PayerID) {
    // One-time payment approved — capture it server-side
    try {
      const accessToken = await getPayPalAccessToken(env)
      const baseUrl = getPayPalBaseUrl(env)

      const res = await fetch(`${baseUrl}/v2/checkout/orders/${token}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (res.ok) {
        const capture = await res.json()
        if (capture.status === 'COMPLETED') {
          // Find and complete the order in DB
          const order = await env.DB
            .prepare('SELECT * FROM orders WHERE paypal_order_id = ? AND status = ?')
            .bind(token, 'pending')
            .first<{ id: string; user_id: string; pack_type: string; credits: number }>()

          if (order) {
            await env.DB.prepare(
              'UPDATE orders SET status = ?, completed_at = datetime("now") WHERE id = ?',
            ).bind('completed', order.id).run()

            await env.DB.prepare(
              'INSERT INTO credits (id, user_id, balance, source, pack_type, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
            ).bind(generateId(), order.user_id, order.credits, 'purchase', order.pack_type).run()

            await env.DB.prepare(
              'INSERT INTO usage_log (id, user_id, action, created_at) VALUES (?, ?, ?, datetime("now"))',
            ).bind(generateId(), order.user_id, `purchase_${order.pack_type}`).run()
          }
        }
      }
    } catch (err) {
      console.error('PayPal capture on success callback error:', err)
    }
    return Response.redirect(`${url.origin}/dashboard?payment=success`, 302)
  }

  return Response.redirect(`${url.origin}/dashboard`, 302)
}

// GET /api/paypal/cancel — frontend redirect after cancelled payment
async function handlePayPalCancel(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  return Response.redirect(`${url.origin}/pricing?payment=cancelled`, 302)
}

// GET /api/paypal/subscription-status — get user's subscription info
async function handlePayPalSubscriptionStatus(request: Request, env: Env): Promise<Response> {
  const { user, origin } = await getUser(request, env)
  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders(origin))
  }

  const sub = await env.DB
    .prepare("SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1")
    .bind(user.id)
    .first<{
      id: string
      plan: string
      tier: string
      amount: number
      credits_per_cycle: number
      created_at: string
      next_billing_at: string
    }>()

  return jsonResponse({
    subscription: sub
      ? {
          plan: sub.plan,
          tier: sub.tier,
          amount: sub.amount,
          creditsPerCycle: sub.credits_per_cycle,
          createdAt: sub.created_at,
        }
      : null,
  }, 200, corsHeaders(origin))
}

// GET /api/paypal/config — public PayPal config for frontend SDK
async function handlePayPalConfig(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin') || ''
  return jsonResponse({
    clientId: env.PAYPAL_CLIENT_ID,
    currency: 'USD',
    mode: env.PAYPAL_MODE || 'sandbox',
  }, 200, corsHeaders(origin))
}

async function handleRemoveBg(request: Request, env: Env): Promise<Response> {
  const { user, origin } = await getSession(request, env)

  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null

    if (!imageFile) {
      return jsonResponse({ error: 'Please upload an image' }, 400)
    }

    // File size limits based on user tier
    let maxFileSize = 2 * 1024 * 1024 // 2MB default (guest)
    if (user) {
      const userInfo = await env.DB
        .prepare('SELECT tier FROM users WHERE google_id = ?')
        .bind(user.google_id)
        .first<{ tier: string }>()
      if (userInfo?.tier === 'pro') {
        maxFileSize = 25 * 1024 * 1024
      } else {
        maxFileSize = 5 * 1024 * 1024
      }
    }

    if (imageFile.size > maxFileSize) {
      return jsonResponse(
        {
          error: `File too large. Maximum size: ${Math.round(maxFileSize / 1024 / 1024)}MB. Upgrade for larger files.`,
          code: 'FILE_TOO_LARGE',
        },
        400,
      )
    }

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(imageFile.type)) {
      return jsonResponse({ error: 'Only PNG, JPG, and WebP formats are supported' }, 400)
    }

    // Call Remove.bg API
    const bgFormData = new FormData()
    bgFormData.append('image_file', imageFile)
    bgFormData.append('size', 'auto')

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': env.REMOVE_BG_API_KEY },
      body: bgFormData,
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Remove.bg API error:', response.status, errText)
      return jsonResponse({ error: 'Background removal failed. Please try again.' }, 502)
    }

    const resultBuffer = await response.arrayBuffer()

    // Determine if watermark should be applied
    let shouldWatermark = true // default: watermark for guests
    if (user) {
      const userInfo = await env.DB
        .prepare('SELECT tier FROM users WHERE google_id = ?')
        .bind(user.google_id)
        .first<{ tier: string }>()
      shouldWatermark = userInfo?.tier !== 'pro'
    }

    return new Response(resultBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': origin || '*',
        'X-Watermark': shouldWatermark ? 'true' : 'false',
      },
    })
  } catch (err) {
    console.error('Worker error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}

// ─── Router ────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': request.headers.get('Origin') || 'https://imagebackgroundremover88ic.shop',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Device-Fingerprint',
          'Access-Control-Allow-Credentials': 'true',
        },
      })
    }

    // Auth routes
    if (path === '/api/auth/login' && request.method === 'GET') {
      return handleLogin(request, env)
    }
    if (path === '/api/auth/callback' && request.method === 'GET') {
      return handleCallback(request, env)
    }
    if (path === '/api/auth/me' && request.method === 'GET') {
      return handleMe(request, env)
    }
    if (path === '/api/auth/logout' && request.method === 'POST') {
      return handleLogout(request, env)
    }

    // Credits routes
    if (path === '/api/credits/balance' && request.method === 'GET') {
      return handleGetBalance(request, env)
    }
    if (path === '/api/credits/deduct' && request.method === 'POST') {
      return handleDeductCredit(request, env)
    }
    if (path === '/api/credits/gift-signup' && request.method === 'POST') {
      return handleGiftSignup(request, env)
    }
    if (path === '/api/credits/history' && request.method === 'GET') {
      return handleGetHistory(request, env)
    }

    // Guest quota routes
    if (path === '/api/guest/quota' && request.method === 'GET') {
      return handleGetGuestQuota(request, env)
    }
    if (path === '/api/guest/track' && request.method === 'POST') {
      return handleTrackGuest(request, env)
    }

    // PayPal routes
    if (path === '/api/paypal/config' && request.method === 'GET') {
      return handlePayPalConfig(request, env)
    }
    if (path === '/api/paypal/create-order' && request.method === 'POST') {
      return handlePayPalCreateOrder(request, env)
    }
    if (path === '/api/paypal/capture-order' && request.method === 'POST') {
      return handlePayPalCaptureOrder(request, env)
    }
    if (path === '/api/paypal/create-subscription' && request.method === 'POST') {
      return handlePayPalCreateSubscription(request, env)
    }
    if (path === '/api/paypal/webhook' && request.method === 'POST') {
      return handlePayPalWebhook(request, env)
    }
    if (path === '/api/paypal/success' && request.method === 'GET') {
      return handlePayPalSuccess(request, env)
    }
    if (path === '/api/paypal/cancel' && request.method === 'GET') {
      return handlePayPalCancel(request, env)
    }
    if (path === '/api/paypal/subscription-status' && request.method === 'GET') {
      return handlePayPalSubscriptionStatus(request, env)
    }

    // Background removal
    if (request.method === 'POST') {
      return handleRemoveBg(request, env)
    }

    return jsonResponse({ error: 'Not found' }, 404)
  },
}
