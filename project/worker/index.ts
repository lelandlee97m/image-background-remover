export interface Env {
  REMOVE_BG_API_KEY: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
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

// ─── OAuth Routes ───────────────────────────────────────────────

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const workerUrl = `${url.protocol}//${url.host}`
  const redirectUri = `${workerUrl}/api/auth/callback`

  // Where to redirect back after login
  const frontendUrl =
    request.headers.get('Referer') ||
    url.searchParams.get('redirect') ||
    workerUrl

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

  const workerUrl = `${url.protocol}//${url.host}`

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${workerUrl}/api/auth/callback`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error('Token exchange failed:', errText)
    return new Response('Failed to exchange authorization code', { status: 502 })
  }

  const tokens = await tokenRes.json<{ id_token: string }>()

  // Decode JWT payload (no need to verify signature — Google is the issuer)
  const payload: GoogleUser = JSON.parse(
    Buffer.from(tokens.id_token.split('.')[1], 'base64').toString(),
  )

  // Create session in D1 (7-day expiry)
  const sessionId = generateSessionToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await env.DB.prepare(
    'INSERT INTO sessions (id, google_id, email, name, picture, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(sessionId, payload.sub, payload.email, payload.name, payload.picture, expiresAt)
    .run()

  // Redirect back to frontend with session cookie
  const frontendUrl = state ? decodeURIComponent(state) : workerUrl

  return new Response(null, {
    status: 302,
    headers: {
      Location: frontendUrl,
      'Set-Cookie': `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
    },
  })
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(/session=([^;]+)/)
  const sessionId = match?.[1]

  if (!sessionId) {
    return jsonResponse({ user: null }, 200, corsHeaders(request.headers.get('Origin') || ''))
  }

  const session = await env.DB
    .prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")')
    .bind(sessionId)
    .first<Session>()

  if (!session) {
    return jsonResponse({ user: null }, 200, corsHeaders(request.headers.get('Origin') || ''))
  }

  return jsonResponse(
    {
      user: {
        id: session.google_id,
        email: session.email,
        name: session.name,
        picture: session.picture,
      },
    },
    200,
    corsHeaders(request.headers.get('Origin') || ''),
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

// ─── Background Removal (original) ─────────────────────────────

async function handleRemoveBg(request: Request, env: Env): Promise<Response> {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null

    if (!imageFile) {
      return jsonResponse({ error: '请上传图片' }, 400)
    }

    if (imageFile.size > 5 * 1024 * 1024) {
      return jsonResponse({ error: '图片大小不能超过 5MB' }, 400)
    }

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(imageFile.type)) {
      return jsonResponse({ error: '仅支持 PNG / JPEG 格式' }, 400)
    }

    const bgFormData = new FormData()
    bgFormData.append('image_file', imageFile)
    bgFormData.append('size', 'auto')

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': env.REMOVE_BG_API_KEY },
      body: bgFormData,
    })

    if (!response.ok) {
      return jsonResponse({ error: '背景去除失败，请稍后重试' }, 502)
    }

    const resultBuffer = await response.arrayBuffer()
    return new Response(resultBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('Worker error:', err)
    return jsonResponse({ error: '服务器内部错误' }, 500)
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
          'Access-Control-Allow-Headers': 'Content-Type',
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

    // Background removal
    if (request.method === 'POST') {
      return handleRemoveBg(request, env)
    }

    return jsonResponse({ error: 'Not found' }, 404)
  },
}
