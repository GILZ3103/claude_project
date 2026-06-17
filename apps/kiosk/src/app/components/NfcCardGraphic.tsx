import { Wifi } from 'lucide-react'

interface NfcCardGraphicProps {
  /** Name printed on the card (e.g. the cardholder). Falls back to a generic label. */
  name?: string
  /** When provided, shows a balance on the card face (RM). */
  balance?: number
  className?: string
}

/**
 * A stylised WarungTek NFC member card (pure CSS/SVG — no network image).
 * Used in the card-offer / dispensing modal and the wallet balance header so the
 * physical card the user is collecting / topping up is visually represented.
 */
export function NfcCardGraphic({ name, balance, className }: NfcCardGraphicProps) {
  return (
    <div
      className={`relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#E8622A] via-[#d4541f] to-[#a83c14] text-white shadow-xl ${className ?? ''}`}
    >
      {/* Decorative rings */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -right-2 top-8 h-24 w-24 rounded-full bg-white/5" />

      <div className="relative flex h-full flex-col p-5">
        <div className="flex items-start justify-between">
          <span className="text-lg font-extrabold tracking-tight">WarungTek</span>
          {/* Contactless symbol (rotated wifi arcs) */}
          <Wifi className="h-5 w-5 rotate-90 text-white/90" />
        </div>

        {/* EMV-style chip */}
        <div className="mt-3 h-7 w-10 rounded-md bg-gradient-to-br from-yellow-200 to-yellow-400 shadow-inner">
          <div className="mx-auto mt-1 h-5 w-7 rounded-[3px] border border-yellow-600/40" />
        </div>

        <div className="mt-auto">
          {balance != null && (
            <div className="mb-1 text-2xl font-bold leading-none">RM {balance.toFixed(2)}</div>
          )}
          <div className="flex items-end justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/85">
              {name || 'NFC Member Card'}
            </span>
            <span className="font-mono text-sm tracking-[0.25em] text-white/90">•••• 0001</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NfcCardGraphic
