const BASE = import.meta.env.VITE_API_URL

async function request<T>(path: string, options?: RequestInit, cardUid?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cardUid) headers['x-card-uid'] = cardUid
  const res = await fetch(`${BASE}${path}`, { headers, ...options })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'API error')
  return json.data
}

// Auth — reads card UID from localStorage
const getUid = () => localStorage.getItem('vendor_card_uid') ?? undefined

// Card / Auth
export const getCard = (uid: string) => request(`/api/cards/${uid}`)

export const registerVendor = (body: {
  owner_card_uid: string
  business_name: string
  category?: string
  description?: string
  grid_x?: number
  grid_y?: number
  terminal_mac_address?: string
}) => request('/api/vendors/register', { method: 'POST', body: JSON.stringify(body) })

// Food items
export const getVendorFood = (vendor_id: string) =>
  request(`/api/vendors/${vendor_id}/food`, undefined, getUid())

export const addFoodItem = (vendor_id: string, body: {
  name: string
  calories: number
  price_in_points: number
  photo_url?: string
}) => request(`/api/vendors/${vendor_id}/food`, { method: 'POST', body: JSON.stringify(body) }, getUid())

// Campaigns
export const getCampaigns = () => request('/api/campaigns')

// Subsidy
export const getVendorSummary = (vendor_id: string) =>
  request(`/api/vendors/${vendor_id}/summary`, undefined, getUid())

export const submitClaim = (vendor_id: string, claim_period_start: string, claim_period_end: string) =>
  request(`/api/vendors/${vendor_id}/claim`, {
    method: 'POST',
    body: JSON.stringify({ claim_period_start, claim_period_end }),
  }, getUid())

export const getVendorClaims = (vendor_id: string) =>
  request(`/api/vendors/${vendor_id}/claims`, undefined, getUid())
