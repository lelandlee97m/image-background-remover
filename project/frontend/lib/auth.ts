// All API calls use relative paths (same-origin via Cloudflare custom domain route /api/* -> Worker)
// For local dev with a separate Worker, set NEXT_PUBLIC_WORKER_URL=http://localhost:8787

export interface User {
  id: string
  email: string
  name: string
  picture: string
  tier: string
}

export async function getUser(): Promise<User | null> {
  try {
    const res = await fetch(`/api/auth/me`, {
      credentials: 'include',
    })
    const data = await res.json()
    return data.user ?? null
  } catch {
    return null
  }
}

export function loginUrl(): string {
  const redirect = encodeURIComponent(window.location.origin)
  return `/api/auth/login?redirect=${redirect}`
}

export async function logout(): Promise<void> {
  try {
    await fetch(`/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // ignore
  }
}

// ─── Credits API ──────────────────────────────────────────────

export async function getCreditBalance(): Promise<number> {
  try {
    const res = await fetch(`/api/credits/balance`, {
      credentials: 'include',
    })
    const data = await res.json()
    return data.balance ?? 0
  } catch {
    return 0
  }
}

export async function deductCredit(): Promise<{ success: boolean; balance: number; error?: string }> {
  try {
    const res = await fetch(`/api/credits/deduct`, {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) {
      return { success: false, balance: 0, error: data.error || 'Failed to deduct credit' }
    }
    return { success: true, balance: data.balance }
  } catch {
    return { success: false, balance: 0, error: 'Network error' }
  }
}

export async function claimSignupGift(): Promise<{ success: boolean; credits?: number; error?: string }> {
  try {
    const res = await fetch(`/api/credits/gift-signup`, {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to claim gift' }
    }
    return { success: true, credits: data.credits }
  } catch {
    return { success: false, error: 'Network error' }
  }
}

export interface UsageRecord {
  id: string
  user_id: string
  device_fingerprint: string | null
  ip_address: string | null
  action: string
  created_at: string
}

export async function getUsageHistory(page = 1, limit = 20): Promise<{
  history: UsageRecord[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}> {
  try {
    const res = await fetch(`/api/credits/history?page=${page}&limit=${limit}`, {
      credentials: 'include',
    })
    return await res.json()
  } catch {
    return { history: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }
  }
}

// ─── Guest Quota API ──────────────────────────────────────────

export async function getGuestQuota(fingerprint: string): Promise<{ remaining: number; used: number; total: number }> {
  try {
    const res = await fetch(`/api/guest/quota`, {
      headers: { 'X-Device-Fingerprint': fingerprint },
    })
    return await res.json()
  } catch {
    return { remaining: 3, used: 0, total: 3 }
  }
}

export async function trackGuestUsage(fingerprint: string): Promise<{ success: boolean; remaining: number; error?: string }> {
  try {
    const res = await fetch(`/api/guest/track`, {
      method: 'POST',
      headers: { 'X-Device-Fingerprint': fingerprint },
    })
    const data = await res.json()
    if (!res.ok) {
      return { success: false, remaining: 0, error: data.error || 'Failed' }
    }
    return { success: true, remaining: data.remaining }
  } catch {
    return { success: false, remaining: 0, error: 'Network error' }
  }
}

// ─── Device Fingerprint ───────────────────────────────────────

export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return ''
  const stored = localStorage.getItem('_ibr_fp')
  if (stored) return stored
  // Generate a simple fingerprint
  const fp = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ].join('|')
  // Simple hash
  let hash = 0
  for (let i = 0; i < fp.length; i++) {
    const char = fp.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  const id = Math.abs(hash).toString(36)
  localStorage.setItem('_ibr_fp', id)
  return id
}
