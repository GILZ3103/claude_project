const BASE = import.meta.env.VITE_API_URL

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'API error')
  return json.data
}

// Cards
export const registerCard = (uid: string, owner_name: string, owner_email: string) =>
  request('/api/cards/register', {
    method: 'POST',
    body: JSON.stringify({ uid, owner_name, owner_email }),
  })

export const getCard = (uid: string) => request(`/api/cards/${uid}`)

export const getCardHistory = (uid: string, limit = 50, offset = 0) =>
  request(`/api/cards/${uid}/history?limit=${limit}&offset=${offset}`)

export const getCardVouchers = (uid: string, status?: string) =>
  request(`/api/cards/${uid}/vouchers${status ? `?status=${status}` : ''}`)

export const topup = (uid: string, amount: number) =>
  request(`/api/cards/${uid}/topup`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  })

export const setCalorieLimit = (uid: string, calorie_limit: number) =>
  request(`/api/cards/${uid}/calorie-limit`, {
    method: 'PATCH',
    body: JSON.stringify({ calorie_limit }),
  })

// Vendors
export const getVendors = () => request('/api/vendors')

export const getVendorFood = (vendor_id: string) =>
  request(`/api/vendors/${vendor_id}/food`)

// Campaigns
export const getCampaigns = (card_uid?: string) =>
  request(`/api/campaigns${card_uid ? `?card_uid=${card_uid}` : ''}`)

export const enrolCampaign = (campaign_id: string, card_uid: string) =>
  request(`/api/campaigns/${campaign_id}/enrol`, {
    method: 'POST',
    body: JSON.stringify({ card_uid }),
  })

// Map
export const getMap = () => request('/api/map')
