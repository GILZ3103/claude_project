import type { ReactNode } from 'react'
import { ImageWithFallback } from './ImageWithFallback'
import { getHeroImage } from '../lib/foodImages'

/**
 * Page header with a real banner photo behind the title.
 * Keeps the warm-orange brand via a gradient overlay on top of the image.
 */
export function HeroHeader({
  title,
  subtitle,
  image,
  seed,
  height = 'h-44',
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  image?: string
  seed?: string
  height?: string
  children?: ReactNode
}) {
  return (
    <div className={`relative ${height} w-full overflow-hidden rounded-b-[2.5rem] shadow-md`}>
      <ImageWithFallback
        src={image ?? getHeroImage(seed)}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Brand gradient overlay for legibility + warm tone */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF8A00]/85 via-[#FF8A00]/55 to-[#1A1A1A]/70" />
      <div className="relative z-10 h-full flex flex-col justify-end p-6">
        {subtitle && <p className="text-white/85 text-sm font-medium mb-1">{subtitle}</p>}
        <h1 className="text-3xl font-bold tracking-tight text-white leading-tight drop-shadow-sm">{title}</h1>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  )
}

export default HeroHeader
