const BASE = import.meta.env.VITE_API_URL

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: extraHeaders, ...restOptions } = options ?? {}
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    ...restOptions,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.message ?? json.error ?? 'API error')
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

export const uploadCardPhoto = (uid: string, dataUrl: string) =>
  request(`/api/cards/${uid}/photo`, { method: 'POST', body: JSON.stringify({ dataUrl }) })

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
  phone_number?: string
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

// AI agent (function-calling, single endpoint)
export const askAgent = (message: string, card_uid: string) =>
  request('/api/ai/agent', { method: 'POST', body: JSON.stringify({ message, card_uid }) })

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

// Admin functions
export const getAdminPendingVendors = (card_uid: string) =>
  request('/api/vendors/admin/pending', { headers: { 'x-card-uid': card_uid } } as any)

export const reviewVendor = (vendor_id: string, card_uid: string, action: 'APPROVE' | 'REJECT', rejection_reason?: string) =>
  request(`/api/vendors/${vendor_id}/admin/review`, {
    method: 'POST',
    body: JSON.stringify({ action, rejection_reason }),
    headers: { 'x-card-uid': card_uid }
  } as any)

// Admin assigns a vendor's stall position on the market map (grid_x/grid_y).
export const setVendorPosition = (vendor_id: string, card_uid: string, grid_x: number, grid_y: number) =>
  request(`/api/vendors/${vendor_id}/position`, {
    method: 'PATCH',
    body: JSON.stringify({ grid_x, grid_y }),
    headers: { 'x-card-uid': card_uid }
  } as any)

export const getAdminCampaignApplications = (card_uid: string) =>
  request(`/api/campaigns/applications/admin?card_uid=${card_uid}`)

export const reviewCampaignApplication = (app_id: string, card_uid: string, action: 'APPROVE' | 'REJECT', rejection_reason?: string) =>
  request(`/api/campaigns/applications/${app_id}/review`, {
    method: 'POST',
    body: JSON.stringify({ card_uid, action, rejection_reason })
  })

// Mini Game
export const spinWheel = (card_uid: string) =>
  request<{ prizeIndex: number; label: string; points: number }>('/api/game/spin', {
    method: 'POST',
    body: JSON.stringify({ card_uid }),
  })

// Skill games (Ingredient Slicer, Stack Tower, Boba Pop, Roti Road)
export type GameKey = 'FLAPPY' | 'STACK' | 'SLICER' | 'BUBBLE' | 'ROAD'

export interface GameScoreResult {
  best: number
  isHighScore: boolean
  newVouchers: { milestone: number; discount_value: number }[]
}

export const submitGameScore = (card_uid: string, game: GameKey, score: number) =>
  request<GameScoreResult>('/api/game/score', {
    method: 'POST',
    body: JSON.stringify({ card_uid, game, score }),
  })

export interface LeaderboardEntry {
  rank: number
  name: string
  score: number
}

export const getLeaderboard = (game: GameKey, limit = 10) =>
  request<LeaderboardEntry[]>(`/api/game/leaderboard?game=${game}&limit=${limit}`)

export type GameStats = Partial<Record<GameKey, { best_score: number; total_plays: number }>>

export const getMyGameStats = (card_uid: string) =>
  request<GameStats>(`/api/game/stats?card_uid=${card_uid}`)

// Map
export interface MapAnchor {
  anchor_id: string
  label: string | null
  beacon_minor: number
  grid_x: number
  grid_y: number
  rssi_at_1m: number
  path_loss_n: number
  /** Vendor stall this beacon is mounted at; its grid_x/grid_y is the beacon's position. */
  vendor_id: string | null
  business_name: string | null
}
export interface MapData {
  grid_size: { cols: number; rows: number }
  vendors: any[]
  kiosks: any[]
  anchors: MapAnchor[]
}
export const getMap = () => request<MapData>('/api/map')
