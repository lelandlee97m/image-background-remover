export interface Env {
  REMOVE_BG_API_KEY: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  OAUTH_REDIRECT_URI: string
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
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
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
      'Set-Cookie': `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
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
      'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
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
          'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
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

    // Background removal
    if (request.method === 'POST') {
      return handleRemoveBg(request, env)
    }

    return jsonResponse({ error: 'Not found' }, 404)
  },
}
