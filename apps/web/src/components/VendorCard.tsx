import { motion } from 'motion/react'
import { MapPin, Store, ChevronRight, Utensils } from 'lucide-react'
import { ImageWithFallback } from './ImageWithFallback'
import { getVendorImage } from '../lib/foodImages'
import { IconBadge, StatPill } from './Badges'

export interface VendorLike {
  vendor_id?: string
  business_name?: string
  category?: string
  description?: string | null
  grid_x?: number | null
  grid_y?: number | null
}

/** Image-forward vendor card: photo hero + category badge + minimal text. */
export function VendorCard({
  vendor,
  firstFood,
  onClick,
}: {
  vendor: VendorLike
  firstFood?: { photo_url?: string | null } | null
  onClick?: () => void
}) {
  return (
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="text-left bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group w-full"
    >
      <div className="relative h-36 overflow-hidden bg-gray-100">
        <ImageWithFallback
          src={getVendorImage(vendor, firstFood)}
          alt={vendor.business_name ?? 'Vendor'}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        {vendor.category && (
          <div className="absolute top-2 left-2">
            <IconBadge icon={Utensils} tone="orange">{vendor.category}</IconBadge>
          </div>
        )}
        <div className="absolute bottom-2 left-3 right-3">
          <h3 className="font-bold text-base text-white leading-tight drop-shadow line-clamp-1">{vendor.business_name}</h3>
        </div>
      </div>
      <div className="p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          {vendor.description ? (
            <p className="text-xs text-[#6B7280] line-clamp-1">{vendor.description}</p>
          ) : (
            <StatPill icon={Store} tone="gray">Tap to view menu</StatPill>
          )}
          {vendor.grid_x != null && vendor.grid_y != null && (
            <StatPill icon={MapPin} tone="orange" className="mt-1 text-[#6B7280]">
              Stall {vendor.grid_x}, {vendor.grid_y}
            </StatPill>
          )}
        </div>
        <span className="shrink-0 w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </span>
      </div>
    </motion.button>
  )
}

export default VendorCard
