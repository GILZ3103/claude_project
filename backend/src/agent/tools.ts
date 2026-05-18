import { SchemaType, FunctionDeclaration } from '@google/generative-ai'
import { supabase } from '../lib/supabase'

// Tool context — what the runner injects, not visible to Gemini
export interface ToolContext {
  card_uid: string
}

// Tool definition shape
interface Tool {
  schema: FunctionDeclaration
  execute: (args: any, ctx: ToolContext) => Promise<any>
}

// ──────────────────────────────────────────────────────────────
// READ TOOLS
// ──────────────────────────────────────────────────────────────

const getMyBalance: Tool = {
  schema: {
    name: 'getMyBalance',
    description: "Look up the current user's wallet balance in RM. Use whenever the user asks about points, money, balance, or whether they can afford something.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  async execute(_args, { card_uid }) {
    const { data, error } = await supabase
      .from('cards')
      .select('points_balance')
      .eq('uid', card_uid)
      .single()
    if (error || !data) return { error: 'Card not found' }
    return { balance_rm: Number(data.points_balance) }
  },
}

const getMyCaloriesToday: Tool = {
  schema: {
    name: 'getMyCaloriesToday',
    description: "Look up the user's calorie intake today vs their daily target. Use when user asks about calories, how much they ate, if they're over their limit, or how much they can still eat.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  async execute(_args, { card_uid }) {
    const today = new Date().toISOString().split('T')[0]
    const { data: card } = await supabase
      .from('cards')
      .select('calorie_limit')
      .eq('uid', card_uid)
      .single()
    const { data: taps } = await supabase
      .from('tap_events')
      .select('metadata')
      .eq('card_uid', card_uid)
      .eq('event_type', 'TAP_PURCHASE')
      .gte('server_timestamp', `${today}T00:00:00+08:00`)
      .lte('server_timestamp', `${today}T23:59:59+08:00`)
    const kcal_today = (taps ?? []).reduce(
      (sum, t: any) => sum + (t.metadata?.calories ?? 0), 0
    )
    const kcal_limit = card?.calorie_limit ?? 2000
    const remaining = Math.max(0, kcal_limit - kcal_today)
    const ratio = kcal_limit > 0 ? kcal_today / kcal_limit : 0
    const status = ratio > 1 ? 'over_limit' : ratio > 0.8 ? 'near_limit' : 'healthy'
    return { kcal_today, kcal_limit, remaining, status }
  },
}

const getMyHistory: Tool = {
  schema: {
    name: 'getMyHistory',
    description: "List the user's recent tap-purchase history. Use when user asks 'what did I eat', 'recent purchases', or specifies a recent day. Default 3 days, max 30.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        days: { type: SchemaType.NUMBER, description: 'How many days back to look (default 3, max 30)' },
      },
    },
  },
  async execute(args, { card_uid }) {
    const days = Math.min(Math.max(Number(args?.days ?? 3), 1), 30)
    const cutoff = new Date(Date.now() - days * 86400000).toISOString()
    const { data } = await supabase
      .from('tap_events')
      .select('event_type, metadata, server_timestamp, vendors(business_name)')
      .eq('card_uid', card_uid)
      .gte('server_timestamp', cutoff)
      .order('server_timestamp', { ascending: false })
      .limit(30)
    const items = (data ?? []).map((e: any) => ({
      food: e.metadata?.food_name ?? e.event_type,
      vendor: e.vendors?.business_name ?? '—',
      kcal: e.metadata?.calories ?? null,
      cost_rm: e.metadata?.final_cost ?? null,
      when: e.server_timestamp,
    }))
    return { days_back: days, items }
  },
}

const getMyCampaigns: Tool = {
  schema: {
    name: 'getMyCampaigns',
    description: "List active campaigns with the user's progress. Use when user asks about rewards, vouchers, what campaigns they're in, or how close to earning something.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  async execute(_args, { card_uid }) {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('campaign_id, name, condition_type, condition_threshold, reward_value')
      .eq('is_active', true)
    const { data: progressRows } = await supabase
      .from('campaign_progress')
      .select('campaign_id, current_value, completed')
      .eq('card_uid', card_uid)
    const progressMap = new Map((progressRows ?? []).map((p: any) => [p.campaign_id, p]))
    const items = (campaigns ?? []).map((c: any) => {
      const p: any = progressMap.get(c.campaign_id)
      return {
        name: c.name,
        condition: c.condition_type === 'SPEND_POINTS'
          ? `Spend RM ${c.condition_threshold}`
          : c.condition_type === 'VISIT_STALLS'
          ? `Visit ${c.condition_threshold} stalls`
          : `Tap kiosk ${c.condition_threshold} time(s)`,
        reward_rm: Number(c.reward_value),
        joined: !!p,
        progress: p?.current_value ?? 0,
        threshold: Number(c.condition_threshold),
        completed: !!p?.completed,
      }
    })
    return { items }
  },
}

const searchFood: Tool = {
  schema: {
    name: 'searchFood',
    description: 'Search the market food menu. Use when user wants recommendations, asks for spicy/sweet/cheap food, or wants something under a calorie limit. Returns up to 10 items with vendor, food name, calories, and price.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: 'Food name, descriptor, or category (e.g. "spicy", "nasi lemak", "dessert")' },
        max_calories: { type: SchemaType.NUMBER, description: 'Optional calorie ceiling (only return items at or below this kcal)' },
      },
      required: ['query'],
    },
  },
  async execute(args) {
    const query: string = String(args?.query ?? '').trim()
    const maxCal = args?.max_calories ? Number(args.max_calories) : null
    if (!query) return { items: [] }
    let q = supabase
      .from('food_items')
      .select('name, calories, price_in_points, calories_per_100g, price_per_100g, vendors!inner(business_name, is_active)')
      .eq('is_active', true)
      .ilike('name', `%${query}%`)
      .limit(20)
    if (maxCal != null) q = q.lte('calories', maxCal)
    const { data } = await q
    const items = (data ?? [])
      .filter((i: any) => i.vendors?.is_active)
      .slice(0, 10)
      .map((i: any) => ({
        vendor: i.vendors?.business_name,
        food: i.name,
        kcal: i.calories ?? (i.calories_per_100g ? `${i.calories_per_100g}/100g` : null),
        price_rm: i.price_in_points ?? (i.price_per_100g ? `${i.price_per_100g}/100g` : null),
      }))
    return { query, max_calories: maxCal, items }
  },
}

const getVendor: Tool = {
  schema: {
    name: 'getVendor',
    description: "Look up a specific vendor by name and return their menu. Use when user asks 'what's at <vendor>' or 'tell me about <vendor>'.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: 'Vendor business name (partial match OK)' },
      },
      required: ['name'],
    },
  },
  async execute(args) {
    const name: string = String(args?.name ?? '').trim()
    if (!name) return { error: 'Vendor name required' }
    const { data: vendor } = await supabase
      .from('vendors')
      .select('vendor_id, business_name, category, description, grid_x, grid_y')
      .eq('is_active', true)
      .ilike('business_name', `%${name}%`)
      .limit(1)
      .single()
    if (!vendor) return { error: `No vendor found matching "${name}"` }
    const { data: menu } = await supabase
      .from('food_items')
      .select('name, calories, price_in_points')
      .eq('vendor_id', vendor.vendor_id)
      .eq('is_active', true)
      .limit(15)
    return {
      vendor: vendor.business_name,
      category: vendor.category,
      description: vendor.description,
      grid: vendor.grid_x != null ? `(${vendor.grid_x},${vendor.grid_y})` : null,
      menu_items: (menu ?? []).map((m: any) => ({
        food: m.name,
        kcal: m.calories,
        price_rm: m.price_in_points ? Number(m.price_in_points) : null,
      })),
    }
  },
}

// ──────────────────────────────────────────────────────────────
// WRITE TOOLS
// ──────────────────────────────────────────────────────────────

const joinCampaign: Tool = {
  schema: {
    name: 'joinCampaign',
    description: 'Enrol the user in an active campaign by its name. Use when user says "join", "sign me up", or "enrol me in" a campaign. Look up the exact campaign first via getMyCampaigns if unsure.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        campaign_name: { type: SchemaType.STRING, description: 'Name of the campaign (partial match OK)' },
      },
      required: ['campaign_name'],
    },
  },
  async execute(args, { card_uid }) {
    const name: string = String(args?.campaign_name ?? '').trim()
    if (!name) return { error: 'Campaign name required' }
    const { data: matches } = await supabase
      .from('campaigns')
      .select('campaign_id, name')
      .eq('is_active', true)
      .ilike('name', `%${name}%`)
      .limit(5)
    if (!matches || matches.length === 0) {
      return { error: `No active campaign found matching "${name}"` }
    }
    if (matches.length > 1) {
      return {
        error: 'Multiple campaigns match — be more specific',
        candidates: matches.map((m: any) => m.name),
      }
    }
    const campaign = matches[0]
    const { data: existing } = await supabase
      .from('campaign_progress')
      .select('progress_id')
      .eq('card_uid', card_uid)
      .eq('campaign_id', campaign.campaign_id)
      .single()
    if (existing) return { joined: false, reason: 'Already enrolled', campaign: campaign.name }
    const { error } = await supabase
      .from('campaign_progress')
      .insert({ card_uid, campaign_id: campaign.campaign_id, current_value: 0, completed: false })
    if (error) return { error: 'Failed to enrol' }
    return { joined: true, campaign: campaign.name }
  },
}

const setMyCalorieGoal: Tool = {
  schema: {
    name: 'setMyCalorieGoal',
    description: "Update the user's daily calorie limit. Use when user says 'change my goal', 'set my limit to X', or 'I want to track N calories per day'. Range: 1200–4000 kcal.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        kcal: { type: SchemaType.NUMBER, description: 'New daily calorie limit (1200–4000)' },
      },
      required: ['kcal'],
    },
  },
  async execute(args, { card_uid }) {
    const kcal = Math.round(Number(args?.kcal ?? 0))
    if (!Number.isFinite(kcal) || kcal < 1200 || kcal > 4000) {
      return { error: 'Calorie limit must be between 1200 and 4000' }
    }
    const { error } = await supabase
      .from('cards')
      .update({ calorie_limit: kcal })
      .eq('uid', card_uid)
    if (error) return { error: 'Failed to update calorie limit' }
    return { updated: true, new_limit: kcal }
  },
}

// ──────────────────────────────────────────────────────────────
// REGISTRY
// ──────────────────────────────────────────────────────────────

export const TOOLS: Record<string, Tool> = {
  getMyBalance,
  getMyCaloriesToday,
  getMyHistory,
  getMyCampaigns,
  searchFood,
  getVendor,
  joinCampaign,
  setMyCalorieGoal,
}

export const ALL_TOOL_SCHEMAS: FunctionDeclaration[] = Object.values(TOOLS).map(t => t.schema)

export async function executeTool(name: string, args: any, ctx: ToolContext): Promise<any> {
  const tool = TOOLS[name]
  if (!tool) return { error: `Unknown tool: ${name}` }
  try {
    return await tool.execute(args ?? {}, ctx)
  } catch (e: any) {
    return { error: `Tool ${name} failed: ${e?.message ?? 'unknown error'}` }
  }
}
