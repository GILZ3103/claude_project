/**
 * Transform backend vendor + food data into the Figma Stall interface shape.
 * Fills in sensible defaults for fields our backend doesn't track yet.
 */

import type { Stall, MenuItem, StallCategory } from '../app/data'

const BASE_API = import.meta.env.VITE_API_URL
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
    image: item.photo_url ?? `https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80`,
  }
}

export function vendorToStall(vendor: any, foods: any[] = []): Stall {
  const menu: MenuItem[] = foods
    .filter((f: any) => f.vendor_id === vendor.vendor_id || f.vendors?.vendor_id === vendor.vendor_id)
    .slice(0, 6)
    .map(foodItemToMenuItem)

  const firstFood = menu[0]

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
    image: menu.find(m => m.image && !m.image.includes('unsplash'))?.image
      ?? `https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80`,
    zone: gridToZone(vendor.grid_x ?? 0, vendor.grid_y ?? 0),
    menu,
    operatingStatus: 'Open Now',
  }
}

export async function fetchStalls(): Promise<Stall[]> {
  try {
    const [vendorsRes, foodsRes] = await Promise.all([
      fetch(`${BASE_API}/api/vendors`),
      fetch(`${BASE_API}/api/kiosk/foods`),
    ])
    const [vendorsJson, foodsJson] = await Promise.all([
      vendorsRes.json(),
      foodsRes.json(),
    ])
    const vendors: any[] = vendorsJson.data ?? []
    const foods: any[] = foodsJson.data ?? []
    return vendors.map(v => vendorToStall(v, foods))
  } catch {
    return []
  }
}
