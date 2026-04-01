const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || ''

export interface User {
  id: string
  email: string
  name: string
  picture: string
}

export async function getUser(): Promise<User | null> {
  if (!WORKER_URL) return null
  try {
    const res = await fetch(`${WORKER_URL}/api/auth/me`, {
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
  return `${WORKER_URL}/api/auth/login?redirect=${redirect}`
}

export async function logout(): Promise<void> {
  if (!WORKER_URL) return
  try {
    await fetch(`${WORKER_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // ignore
  }
}
