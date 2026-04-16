const apiBase = process.env.NEXT_PUBLIC_WORKER_URL || ''

export interface PayPalConfig {
  clientId: string
  currency: string
  mode: string
}

export interface CreateOrderResult {
  orderId: string
  dbOrderId: string
}

export interface CreateSubscriptionResult {
  subscriptionId: string
  approveLink: string
}

export interface CaptureOrderResult {
  success: boolean
  credits: number
  packType: string
}

export interface SubscriptionInfo {
  plan: string
  tier: string
  amount: number
  creditsPerCycle: number
  createdAt: string
}

export async function getPayPalConfig(): Promise<PayPalConfig> {
  try {
    const res = await fetch(`${apiBase}/api/paypal/config`)
    return await res.json()
  } catch {
    return { clientId: '', currency: 'USD', mode: 'sandbox' }
  }
}

export async function createOrder(packType: string): Promise<CreateOrderResult> {
  const res = await fetch(`${apiBase}/api/paypal/create-order`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packType }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to create order')
  return data
}

export async function captureOrder(paypalOrderId: string): Promise<CaptureOrderResult> {
  const res = await fetch(`${apiBase}/api/paypal/capture-order`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paypalOrderId }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to capture payment')
  return data
}

export async function createSubscription(plan: string): Promise<CreateSubscriptionResult> {
  const res = await fetch(`${apiBase}/api/paypal/create-subscription`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to create subscription')
  return data
}

export async function getSubscriptionStatus(): Promise<SubscriptionInfo | null> {
  try {
    const res = await fetch(`${apiBase}/api/paypal/subscription-status`, {
      credentials: 'include',
    })
    const data = await res.json()
    return data.subscription ?? null
  } catch {
    return null
  }
}

/** Load PayPal JS SDK dynamically and return the global paypal object */
export function loadPayPalSDK(clientId: string, currency = 'USD'): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).paypal) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = `https://www.sandbox.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&intent=capture&vault=true`
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load PayPal SDK'))
    document.head.appendChild(script)
  })
}
