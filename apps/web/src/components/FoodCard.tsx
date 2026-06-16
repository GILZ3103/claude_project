import { motion } from 'motion/react'
import { Flame, Star } from 'lucide-react'
import { ImageWithFallback } from './ImageWithFallback'
import { getFoodImage } from '../lib/foodImages'

export interface FoodLike {
  food_id?: string
  food_item_id?: string
  name?: string
  category?: string
  calories?: number | null
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  price_in_points?: number | string
  photo_url?: string | null
  vendor_name?: string | null
  rating?: number
}

/** Image-forward food card: photo hero + calorie pill + minimal text. */
export function FoodCard({ item, onClick }: { item: FoodLike; onClick?: () => void }) {
  const price = item.price_in_points != null ? Number(item.price_in_points).toFixed(2) : null
  return (
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="text-left bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group w-full"
    >
      <div className="relative h-32 overflow-hidden bg-gray-100">
        <ImageWithFallback
          src={getFoodImage(item)}
          alt={item.name ?? 'Food'}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {item.calories != null && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            <Flame className="w-3 h-3 text-orange-400" />
            {item.calories} kcal
          </span>
        )}
        {item.rating != null && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm text-amber-600 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
            {item.rating}
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-sm text-[#1A1A1A] leading-tight line-clamp-1">{item.name}</p>
          {price && <span className="shrink-0 text-sm font-bold text-green-700">RM {price}</span>}
        </div>
        {item.vendor_name && <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">{item.vendor_name}</p>}
        {(Number(item.protein_g) > 0 || Number(item.carbs_g) > 0 || Number(item.fat_g) > 0) && (
          <div className="flex gap-1.5 mt-2">
            <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">P {item.protein_g}g</span>
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">C {item.carbs_g}g</span>
            <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">F {item.fat_g}g</span>
          </div>
        )}
      </div>
    </motion.button>
  )
}

export default FoodCard
