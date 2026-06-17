/**
 * Transform backend vendor + food data into the Figma Stall interface shape.
 * Fills in sensible defaults for fields our backend doesn't track yet.
 */

import type { Stall, MenuItem, StallCategory } from '../app/data'
import { getFoodImage, getVendorImage } from '../app/foodImages'

// Fall back to the production URL if the build-time env var is missing (e.g. no .env on the Pi).
const RAW_API = import.meta.env.VITE_API_URL || 'https://warungtek-backend.onrender.com'
// Guarantee a protocol — a bare host makes fetch() treat the URL as a relative path,
// which resolves to http://localhost:3000/<host>/... and 404s.
const BASE_API = /^https?:\/\//.test(RAW_API) ? RAW_API : `https://${RAW_API}`
const KIOSK_GRID = { x: 5, y: 4 } // kiosk position on the map

// Map backend category strings to Figma StallCategory
const CATEGORY_MAP: Record<string, StallCategory> = {
  'drinks': 'Drinks',
  'desserts': 'Desserts',
  'dessert': 'Desserts',
  'rice': 'Rice Meals',
  'rice meals': 'Rice Meals',
  'seafood': 'Seafood',
  'healthy': 'Healthy Choices',
  'healthy choices': 'Healthy Choices',
  'snacks': 'Snacks',
  'snack': 'Snacks',
  'beverages': 'Beverages',
  'beverage': 'Beverages',
  'local': 'Local Favorites',
  'local favorites': 'Local Favorites',
}

function mapCategory(raw: string): StallCategory {
  const key = (raw || '').toLowerCase().trim()
  for (const [k, v] of Object.entries(CATEGORY_MAP)) {
    if (key.includes(k)) return v
  }
  return 'Local Favorites'
}

function gridToZone(x: number, y: number): string {
  const col = String.fromCharCode(65 + Math.floor(x / 2)) // A, B, C...
  const row = (y % 5) + 1
  return `${col}${row}`
}

function calcDistance(grid_x: number, grid_y: number): number {
  // Approximate 10m per grid unit
  const dx = Math.abs((grid_x ?? 0) - KIOSK_GRID.x)
  const dy = Math.abs((grid_y ?? 0) - KIOSK_GRID.y)
  return Math.round(Math.sqrt(dx * dx + dy * dy) * 10)
}

export function foodItemToMenuItem(item: any): MenuItem {
  return {
    id: item.food_id ?? item.id ?? String(Math.random()),
    name: item.name,
    price: item.price_in_points ? `RM ${Number(item.price_in_points).toFixed(2)}` : 'RM —',
    calories: item.calories ? `${item.calories} kcal` : '—',
    nutritionLabel:
      !item.calories ? 'Orange'
      : item.calories < 300 ? 'Green'
      : item.calories < 600 ? 'Orange'
      : 'Red',
    // Real photo_url wins; otherwise resolve a relevant food photo from name/category.
    image: getFoodImage({
      photo_url: item.photo_url,
      name: item.name,
      category: item.category,
      food_id: item.food_id ?? item.id,
    }),
  }
}

export function vendorToStall(vendor: any, foods: any[] = []): Stall {
  const vendorFoods = foods.filter(
    (f: any) => f.vendor_id === vendor.vendor_id || f.vendors?.vendor_id === vendor.vendor_id,
  )
  const menu: MenuItem[] = vendorFoods.slice(0, 6).map(foodItemToMenuItem)
  const firstFood = menu[0]
  // Prefer a genuine uploaded food photo for the storefront image; else fall back by category/name.
  const realPhoto = vendorFoods.find((f: any) => f.photo_url)?.photo_url ?? null

  return {
    id: vendor.vendor_id,
    name: vendor.business_name,
    featuredFood: firstFood?.name ?? 'Various foods',
    calories: firstFood ? firstFood.calories : '—',
    distance: calcDistance(vendor.grid_x, vendor.grid_y),
    rating: 4.5,
    isHealthy: false,
    isVegetarian: false,
    isLowSugar: false,
    isHalal: true,
    isHighProtein: false,
    isLocalVendor: true,
    isPopularVendor: false,
    hasVoucher: false,
    isFavorite: false,
    isBestseller: false,
    category: mapCategory(vendor.category ?? ''),
    image: getVendorImage(
      { business_name: vendor.business_name, category: vendor.category, vendor_id: vendor.vendor_id },
      realPhoto,
    ),
    zone: gridToZone(vendor.grid_x ?? 0, vendor.grid_y ?? 0),
    grid_x: vendor.grid_x ?? 0,
    grid_y: vendor.grid_y ?? 0,
    menu,
    operatingStatus: 'Open Now',
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Render free-tier backends sleep after inactivity and take ~30s to wake. On a kiosk
// that boots once and runs forever, a single failed fetch would leave the grid empty
// permanently. Retry with backoff so a cold start self-heals without a manual reload.
export async function fetchStalls(retries = 6): Promise<Stall[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const [vendorsRes, foodsRes] = await Promise.all([
        fetch(`${BASE_API}/api/vendors`),
        fetch(`${BASE_API}/api/kiosk/foods`),
      ])
      if (!vendorsRes.ok || !foodsRes.ok) {
        throw new Error(`HTTP ${vendorsRes.status} / ${foodsRes.status}`)
      }
      const [vendorsJson, foodsJson] = await Promise.all([
        vendorsRes.json(),
        foodsRes.json(),
      ])
      const vendors: any[] = vendorsJson.data ?? []
      const foods: any[] = foodsJson.data ?? []
      if (vendors.length === 0) throw new Error('vendors list empty')
      return vendors.map(v => vendorToStall(v, foods))
    } catch (err) {
      console.error(`[fetchStalls] attempt ${attempt + 1}/${retries + 1} failed from ${BASE_API}:`, err)
      if (attempt < retries) await sleep(5000) // 5s × 6 ≈ 30s, enough to cover a Render cold start
    }
  }
  return []
}
