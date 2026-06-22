// Client-side auto description for a food item. The DB has no description field,
// so we compose a short, plausible sentence from the name / vendor / category /
// calories. Purely cosmetic — no backend involved.
import type { FoodLike } from '../components/FoodCard'

// Keyword → flavour phrase, aligned with the buckets in foodImages / Catalogue.
const FLAVOURS: [RegExp, string][] = [
  [/satay|skewer|kebab|grill|bbq/i, 'char-grilled over open flames and served with a rich dipping sauce'],
  [/burger/i, 'stacked fresh and griddled to order'],
  [/noodle|mee|kway|kuey|laksa/i, 'wok-tossed in a savoury house sauce'],
  [/nasi|rice/i, 'served piping hot with fragrant rice'],
  [/takoyaki|ball|nugget|snack|popiah|keropok|fries/i, 'crispy on the outside and made fresh for snacking'],
  [/tea|coffee|kopi|juice|milo|soda|smoothie|latte|teh|drink/i, 'iced and freshly prepared to cool you down'],
  [/fish|prawn|squid|crab|seafood|sotong|ikan/i, 'caught-fresh seafood cooked the night-market way'],
  [/dessert|cake|ice|bingsu|cendol|sweet|mango|cream|kuih/i, 'a sweet treat to finish your night-market run'],
]

function flavourFor(name?: string | null): string {
  const n = name ?? ''
  for (const [re, phrase] of FLAVOURS) if (re.test(n)) return phrase
  return 'a local night-market favourite, freshly made to order'
}

/** Short cosmetic description for a food item. */
export function foodBlurb(item: FoodLike): string {
  const name = item.name?.trim() || 'This dish'
  const vendor = item.vendor_name?.trim()
  const flavour = flavourFor(item.name)
  const cal = item.calories != null ? ` Around ${item.calories} kcal per serving.` : ''
  const from = vendor ? ` from ${vendor}` : ''
  return `${name}${from} — ${flavour}.${cal}`
}
