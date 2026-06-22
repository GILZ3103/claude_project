import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, MapPin, Flame, Store } from 'lucide-react'
import { getAllFood } from '../lib/api'
import { getFoodImage } from '../lib/foodImages'
import { foodBlurb } from '../lib/foodBlurb'
import { ImageWithFallback } from '../components/ImageWithFallback'

const idOf = (f: any) => f?.food_item_id ?? f?.food_id

export default function FoodDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const passed = (location.state as any)?.item

  const [item, setItem] = useState<any | null>(passed ?? null)
  const [loading, setLoading] = useState(!passed)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (passed) return
    let alive = true
    setLoading(true)
    getAllFood()
      .then((res: any) => {
        if (!alive) return
        const found = ((res ?? []) as any[]).find(f => String(idOf(f)) === String(id))
        if (found) setItem(found)
        else setNotFound(true)
      })
      .catch(() => alive && setNotFound(true))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [id, passed])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="h-64 md:h-80 bg-gray-100 rounded-3xl animate-pulse" />
        <div className="h-8 w-48 bg-gray-100 rounded-xl animate-pulse mt-6" />
        <div className="h-4 w-full bg-gray-100 rounded-lg animate-pulse mt-4" />
      </div>
    )
  }

  if (notFound || !item) {
    return (
      <div className="min-h-[60dvh] flex flex-col items-center justify-center text-center px-6 text-gray-400">
        <p className="text-sm mb-4">Sorry, we couldn't find that dish.</p>
        <button onClick={() => navigate('/catalogue')} className="px-5 py-2.5 rounded-xl bg-[#FF8A00] text-white font-semibold text-sm">
          Back to catalogue
        </button>
      </div>
    )
  }

  const perGram = item.price_per_100g != null
  const price = perGram
    ? `RM ${Number(item.price_per_100g).toFixed(2)}`
    : item.price_in_points != null ? `RM ${Number(item.price_in_points).toFixed(2)}` : null
  const calories = item.calories ?? item.calories_per_100g
  const calLabel = item.calories_per_100g != null && item.calories == null ? 'kcal/100g' : 'kcal'

  const macros: { label: string; value: number; cls: string }[] = [
    { label: 'Protein', value: Number(item.protein_g) || 0, cls: 'text-green-700 bg-green-50' },
    { label: 'Carbs', value: Number(item.carbs_g) || 0, cls: 'text-blue-700 bg-blue-50' },
    { label: 'Fat', value: Number(item.fat_g) || 0, cls: 'text-orange-700 bg-orange-50' },
  ]
  const hasMacros = macros.some(m => m.value > 0)

  return (
    <div className="bg-[#FAFAFA] min-h-[100dvh] pb-24">
      <div className="max-w-4xl mx-auto md:px-8 md:pt-6">
        <div className="md:grid md:grid-cols-2 md:gap-8">
          {/* Hero */}
          <div className="relative">
            <div className="relative h-72 md:h-[26rem] md:rounded-[2rem] overflow-hidden bg-gray-100">
              <ImageWithFallback
                src={getFoodImage(item)}
                alt={item.name ?? 'Food'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
              <button
                onClick={() => navigate(-1)}
                aria-label="Back"
                className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center text-[#1A1A1A] hover:bg-white transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
            </div>
          </div>

          {/* Details */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative -mt-6 md:mt-0 bg-white md:bg-transparent rounded-t-[2rem] md:rounded-none px-6 md:px-0 pt-6 md:pt-2"
          >
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold text-[#1A1A1A] leading-tight">{item.name}</h1>
              {price && (
                <span className="shrink-0 text-xl font-bold text-green-700">
                  {price}<span className="text-xs font-medium text-[#6B7280]">{perGram ? ' /100g' : ''}</span>
                </span>
              )}
            </div>
            {item.vendor_name && (
              <p className="text-sm text-[#6B7280] mt-1 flex items-center gap-1.5">
                <Store size={14} className="text-orange-500" /> {item.vendor_name}
              </p>
            )}

            {/* Description */}
            <p className="text-sm text-[#4B5563] leading-relaxed mt-4">{foodBlurb(item)}</p>

            {/* Additional materials — nutrition */}
            <div className="mt-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mb-2">Nutrition</p>
              <div className="flex flex-wrap gap-2">
                {calories != null && (
                  <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 text-sm font-semibold px-3 py-1.5 rounded-xl">
                    <Flame size={14} /> {calories} {calLabel}
                  </span>
                )}
                {hasMacros ? (
                  macros.map(m => (
                    <span key={m.label} className={`text-sm font-semibold px-3 py-1.5 rounded-xl ${m.cls}`}>
                      {m.label} {m.value}g
                    </span>
                  ))
                ) : (
                  calories == null && <span className="text-sm text-gray-400">Nutrition info not available.</span>
                )}
              </div>
            </div>

            {/* Navigate to store */}
            {item.vendor_id && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/map?vendor=${item.vendor_id}`)}
                className="mt-7 w-full flex items-center justify-center gap-2 bg-[#FF8A00] hover:bg-orange-600 text-white font-bold text-sm py-3.5 rounded-2xl shadow-md transition-colors"
              >
                <MapPin size={18} /> Navigate to store
              </motion.button>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
