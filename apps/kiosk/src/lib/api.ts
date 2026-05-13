const BASE = import.meta.env.VITE_API_URL
const NFC_URL = import.meta.env.VITE_NFC_DAEMON_URL

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'API error')
  return json.data
}

// NFC daemon
export const pollNFC = async (): Promise<{ uid: string | null; timestamp: string }> => {
  const res = await fetch(`${NFC_URL}/nfc`)
  return res.json()
}

// Card
export const getCard = (uid: string) => request(`/api/cards/${uid}`)

// Campaigns
export const getCampaigns = (card_uid: string) =>
  request(`/api/campaigns?card_uid=${card_uid}`)

export const enrolCampaign = (campaign_id: string, card_uid: string) =>
  request(`/api/campaigns/${campaign_id}/enrol`, {
    method: 'POST',
    body: JSON.stringify({ card_uid }),
  })

// Kiosk tap — logs DIRECTORY_REBATE
export const kioskTap = (card_uid: string, kiosk_id: string, device_timestamp: string) =>
  request('/api/kiosk/tap', {
    method: 'POST',
    body: JSON.stringify({ card_uid, kiosk_id, device_timestamp }),
  })

// Map
export const getMap = () => request('/api/map')

// Vendors
export const getVendors = () => request('/api/vendors')

// All foods with vendor + grid info (kiosk food browser)
export const getAllFoods = () => request('/api/kiosk/foods')

// AI meal suggestion
export const getMealSuggestion = (calorie_budget: number) =>
  request('/api/ai/meal-advisor', {
    method: 'POST',
    body: JSON.stringify({ calorie_budget, prompt: 'suggest a main dish and two side dishes within my calorie budget' }),
  })

// Save calorie limit to card
export const updateCalorieLimit = (uid: string, calorie_limit: number) =>
  request(`/api/cards/${uid}/calorie-limit`, {
    method: 'PATCH',
    body: JSON.stringify({ calorie_limit }),
  })
