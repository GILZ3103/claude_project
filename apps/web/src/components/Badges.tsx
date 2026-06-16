import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Tone = 'green' | 'orange' | 'red' | 'blue' | 'gray' | 'dark'

const TONES: Record<Tone, string> = {
  green: 'bg-green-100 text-green-800',
  orange: 'bg-orange-100 text-orange-800',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  gray: 'bg-gray-100 text-gray-700',
  dark: 'bg-black/80 text-white backdrop-blur-sm',
}

/** Small icon + label chip, e.g. "Healthy", "Voucher". */
export function IconBadge({
  icon: Icon,
  children,
  tone = 'gray',
  className = '',
}: {
  icon?: LucideIcon
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-sm ${TONES[tone]} ${className}`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  )
}

/** Icon + value metadata pill, e.g. distance / calories / rating. */
export function StatPill({
  icon: Icon,
  children,
  tone = 'gray',
  className = '',
}: {
  icon?: LucideIcon
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${className}`}>
      {Icon && <Icon className={`w-3.5 h-3.5 ${tone === 'orange' ? 'text-orange-500' : tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-500' : tone === 'blue' ? 'text-blue-500' : 'text-gray-400'}`} />}
      {children}
    </span>
  )
}
