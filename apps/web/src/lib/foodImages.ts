// Curated food imagery for the web portal.
//
// The database has no vendor image field and food `photo_url` is mostly empty,
// so we map categories / food names to a small set of known-good Unsplash photos
// (reused from KioskUI's data.ts). Real `photo_url` values always take precedence.
// All <img> rendering should go through <ImageWithFallback> so a broken URL still
// degrades gracefully.

const U = (id: string) =>
  `https://images.unsplash.com/${id}?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080`

// Verified night-market / street-food photos (known to load).
const PHOTOS = {
  satay: U('photo-1772855386828-a18ff9a12584'),    // chicken satay skewers
  burger: U('photo-1774109618787-a080e16de7dd'),   // night-market burger
  noodles: U('photo-1761125174582-a1538be4ec19'),  // fried noodles
  takoyaki: U('photo-1771308458012-e60e667bbddf'),  // takoyaki
  drinks: U('photo-1644204010193-a35de7b0d702'),   // thai iced tea
  seafood: U('photo-1758115271914-76d1acfe305e'),  // grilled seafood
  dessert: U('photo-1765188988267-7018a757f1f3'),  // shaved-ice dessert
} as const

const DEFAULT_POOL = Object.values(PHOTOS)

// Wide shots usable as page hero banners.
export const HERO_IMAGES = [PHOTOS.noodles, PHOTOS.burger, PHOTOS.seafood, PHOTOS.satay]

// Common category labels -> photo.
const CATEGORY_IMAGES: Record<string, string> = {
  snacks: PHOTOS.takoyaki,
  drinks: PHOTOS.drinks,
  beverages: PHOTOS.drinks,
  desserts: PHOTOS.dessert,
  dessert: PHOTOS.dessert,
  seafood: PHOTOS.seafood,
  'rice meals': PHOTOS.noodles,
  noodles: PHOTOS.noodles,
  'healthy choices': PHOTOS.seafood,
  'local favorites': PHOTOS.noodles,
  satay: PHOTOS.satay,
  grill: PHOTOS.satay,
  burgers: PHOTOS.burger,
  'fast food': PHOTOS.burger,
}

// Keyword hints matched against a food / vendor name.
const NAME_KEYWORDS: [RegExp, string][] = [
  [/satay|skewer|kebab|grill/i, PHOTOS.satay],
  [/burger/i, PHOTOS.burger],
  [/noodle|mee|kway|kuey|nasi|rice|fried/i, PHOTOS.noodles],
  [/takoyaki|ball|nugget|snack|popiah|keropok/i, PHOTOS.takoyaki],
  [/tea|coffee|kopi|juice|milo|soda|water|drink|smoothie|latte|teh/i, PHOTOS.drinks],
  [/fish|prawn|squid|crab|seafood|sotong|ikan/i, PHOTOS.seafood],
  [/dessert|cake|ice|bingsu|cendol|sweet|mango|cream|kuih/i, PHOTOS.dessert],
]

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()

// Stable index from a string so the same item always gets the same default photo.
function hashIndex(seed: string, len: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return len > 0 ? h % len : 0
}

function matchByName(name?: string | null): string | undefined {
  const n = name ?? ''
  for (const [re, url] of NAME_KEYWORDS) if (re.test(n)) return url
  return undefined
}

function fallbackImage(name?: string | null, category?: string | null, seed?: string): string {
  return (
    matchByName(name) ??
    CATEGORY_IMAGES[norm(category)] ??
    DEFAULT_POOL[hashIndex(seed || name || category || 'food', DEFAULT_POOL.length)]
  )
}

/** Resolve a food item's image: real photo_url first, else category / name / default. */
export function getFoodImage(item: {
  photo_url?: string | null
  name?: string | null
  category?: string | null
  food_id?: string
  food_item_id?: string
}): string {
  if (item.photo_url) return item.photo_url
  return fallbackImage(item.name, item.category, item.food_item_id || item.food_id || item.name || '')
}

/** Resolve a vendor's image: a representative food photo first, else category / name / default. */
export function getVendorImage(
  vendor: { business_name?: string | null; category?: string | null; vendor_id?: string },
  firstFood?: { photo_url?: string | null } | null
): string {
  if (firstFood?.photo_url) return firstFood.photo_url
  return fallbackImage(vendor.business_name, vendor.category, vendor.vendor_id || vendor.business_name || '')
}

/** A hero banner image, optionally stable per seed (e.g. a user id or page name). */
export function getHeroImage(seed?: string): string {
  return HERO_IMAGES[hashIndex(seed || 'hero', HERO_IMAGES.length)]
}
