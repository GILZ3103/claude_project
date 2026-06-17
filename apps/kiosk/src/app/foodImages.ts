// Curated food imagery for the kiosk terminal.
//
// The backend has no vendor image field and most food `photo_url`s are empty, so we
// map categories / food names to a small set of known-good Unsplash photos. Real
// `photo_url` values always take precedence. Render every <img> through
// <ImageWithFallback> so a broken URL still degrades gracefully on the kiosk.

const U = (id: string) =>
  `https://images.unsplash.com/${id}?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080`

// Verified night-market / street-food photos (the same set already used in data.ts).
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

// Wide shots usable as the home hero banner.
export const HERO_IMAGES = [PHOTOS.noodles, PHOTOS.seafood, PHOTOS.satay, PHOTOS.burger]

// Category label -> representative photo (keys are the StallCategory values, lowercased).
const CATEGORY_IMAGES: Record<string, string> = {
  drinks: PHOTOS.drinks,
  beverages: PHOTOS.drinks,
  desserts: PHOTOS.dessert,
  dessert: PHOTOS.dessert,
  'rice meals': PHOTOS.noodles,
  noodles: PHOTOS.noodles,
  seafood: PHOTOS.seafood,
  'healthy choices': PHOTOS.seafood,
  snacks: PHOTOS.takoyaki,
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
  [/noodle|mee|kway|kuey|nasi|rice|fried|char/i, PHOTOS.noodles],
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

/** Resolve a food item's image: real photo_url first, else name / category / stable default. */
export function getFoodImage(item: {
  photo_url?: string | null
  name?: string | null
  category?: string | null
  food_id?: string
}): string {
  if (item.photo_url) return item.photo_url
  return fallbackImage(item.name, item.category, item.food_id || item.name || '')
}

/** Resolve a vendor's image: a representative food photo first, else name / category / default. */
export function getVendorImage(
  vendor: { business_name?: string | null; category?: string | null; vendor_id?: string },
  firstFoodImage?: string | null,
): string {
  if (firstFoodImage && !firstFoodImage.includes('unsplash')) return firstFoodImage
  return fallbackImage(vendor.business_name, vendor.category, vendor.vendor_id || vendor.business_name || '')
}

/** A photo for a category pill / filter chip. */
export function getCategoryImage(category?: string | null): string {
  return CATEGORY_IMAGES[norm(category)] ?? DEFAULT_POOL[hashIndex(norm(category) || 'cat', DEFAULT_POOL.length)]
}

/** A hero banner image, optionally stable per seed (e.g. a page name). */
export function getHeroImage(seed?: string): string {
  return HERO_IMAGES[hashIndex(seed || 'hero', HERO_IMAGES.length)]
}
