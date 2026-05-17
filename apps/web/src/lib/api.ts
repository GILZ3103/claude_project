const BASE = import.meta.env.VITE_API_URL

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: extraHeaders, ...restOptions } = options ?? {}
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    ...restOptions,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'API error')
  return json.data
}

// Auth
export const registerCard = (body: Record<string, any>) =>
  request('/api/cards/register', { method: 'POST', body: JSON.stringify(body) })

export const loginConsumer = (email: string, password: string) =>
  request('/api/auth/consumer/login', { method: 'POST', body: JSON.stringify({ email, password }) })

export const loginVendor = (email: string, password: string) =>
  request('/api/auth/vendor/login', { method: 'POST', body: JSON.stringify({ email, password }) })

export const loginAdmin = (authority_id: string, email: string, password: string) =>
  request('/api/auth/admin/login', { method: 'POST', body: JSON.stringify({ authority_id, email, password }) })

export const linkNfcCard = (current_uid: string, new_uid: string) =>
  request(`/api/cards/${current_uid}/link`, { method: 'PATCH', body: JSON.stringify({ new_uid }) })

// Cards
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

export const registerVendor = (body: {
  owner_card_uid: string
  business_name: string
  ssm_registration_number: string
  phone_number: string
  category?: string
  description?: string
  grid_x?: number
  grid_y?: number
}) => request('/api/vendors/register', { method: 'POST', body: JSON.stringify(body) })

export const getVendorSummary = (vendor_id: string, card_uid: string) =>
  request(`/api/vendors/${vendor_id}/summary`, { headers: { 'x-card-uid': card_uid } } as any)

export const submitClaim = (vendor_id: string, card_uid: string, claim_period_start: string, claim_period_end: string) =>
  request(`/api/vendors/${vendor_id}/claim`, {
    method: 'POST',
    body: JSON.stringify({ claim_period_start, claim_period_end }),
    headers: { 'x-card-uid': card_uid }
  } as any)

export const getVendorClaims = (vendor_id: string, card_uid: string) =>
  request(`/api/vendors/${vendor_id}/claims`, { headers: { 'x-card-uid': card_uid } } as any)

export const addFoodItem = (vendor_id: string, card_uid: string, body: Record<string, any>) =>
  request(`/api/vendors/${vendor_id}/food`, {
    method: 'POST', body: JSON.stringify(body), headers: { 'x-card-uid': card_uid }
  } as any)

// Compliance records
export const getComplianceRecords = (vendor_id: string, card_uid: string) =>
  request(`/api/vendors/${vendor_id}/compliance`, { headers: { 'x-card-uid': card_uid } } as any)

export const addComplianceRecord = (vendor_id: string, card_uid: string, body: {
  record_type: string; period_label: string; submitted_at: string;
  amount_rm?: number; reference_number?: string; notes?: string
}) => request(`/api/vendors/${vendor_id}/compliance`, {
  method: 'POST', body: JSON.stringify(body), headers: { 'x-card-uid': card_uid }
} as any)

export const deleteComplianceRecord = (vendor_id: string, card_uid: string, record_id: string) =>
  request(`/api/vendors/${vendor_id}/compliance/${record_id}`, {
    method: 'DELETE', headers: { 'x-card-uid': card_uid }
  } as any)

// AI agent
export const askAi = (message: string, role?: string) =>
  request('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message, role }) })

export const getMealAdvice = (prompt: string, calorie_budget: number) =>
  request('/api/ai/meal-advisor', { method: 'POST', body: JSON.stringify({ prompt, calorie_budget }) })

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

// All food items (for recommendations)
export const getAllFood = () => request('/api/vendors/food')

// Campaign applications (vendor-side)
export const applyCampaign = (body: {
  vendor_id: string; card_uid: string; name: string; description?: string;
  period_start?: string; period_end?: string;
  condition_type: string; condition_threshold: number;
  point_deduction?: number; reward_value: number;
}) => request('/api/campaigns/apply', { method: 'POST', body: JSON.stringify(body) })

export const getVendorCampaignApplications = (vendor_id: string, card_uid: string) =>
  request(`/api/campaigns/applications?vendor_id=${vendor_id}&card_uid=${card_uid}`)

// Map
export const getMap = () => request('/api/map')
