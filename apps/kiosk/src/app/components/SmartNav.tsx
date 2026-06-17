import { useState } from 'react';
import { X, Navigation, MapPin, Footprints } from 'lucide-react';
import type { Stall } from '../data';
import { translations } from '../translations';

interface SmartNavProps {
  destination: Stall | null;
  stalls: Stall[];
  onClose: () => void;
  language: 'en' | 'ms' | 'zh';
}

const CATEGORY_COLORS: Record<string, string> = {
  Meals: 'bg-orange-500',
  'Rice Meals': 'bg-orange-500',
  Snacks: 'bg-green-500',
  Drinks: 'bg-blue-500',
  Beverages: 'bg-blue-500',
  Seafood: 'bg-cyan-500',
  Desserts: 'bg-pink-500',
  'Healthy Choices': 'bg-emerald-500',
  'Local Favorites': 'bg-yellow-500',
  Default: 'bg-purple-500',
}

const CATEGORY_BORDERS: Record<string, string> = {
  Meals: 'border-orange-500',
  'Rice Meals': 'border-orange-500',
  Snacks: 'border-green-500',
  Drinks: 'border-blue-500',
  Beverages: 'border-blue-500',
  Seafood: 'border-cyan-500',
  Desserts: 'border-pink-500',
  'Healthy Choices': 'border-emerald-500',
  'Local Favorites': 'border-yellow-500',
  Default: 'border-purple-500',
}

// Spreads stalls across the full canvas — matches web Map.tsx
function gridToPct(gx: number, gy: number) {
  return {
    left: Math.min(88, Math.max(5, (gx / 10) * 83 + 5)),
    top:  Math.min(72, Math.max(5, (gy / 10) * 67 + 5)),
  }
}

// Static kiosk position — bottom-centre of the map (no BLE on kiosk)
const KIOSK = { left: 50, top: 88 }
const CORRIDOR_X = 25
const CORRIDOR_Y = 30

export function SmartNav({ destination, stalls, onClose, language }: SmartNavProps) {
  const t = translations[language];
  const [selected, setSelected] = useState<Stall | null>(destination);

  const destPos = selected
    ? gridToPct(selected.grid_x ?? 5, selected.grid_y ?? 5)
    : null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#EEE9E0]">

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2.5 bg-white/90 backdrop-blur-sm rounded-full shadow-lg text-gray-500 hover:text-black hover:bg-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* ── Map canvas ─────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">

        {/* Grid + walkways + route */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Fine grid */}
          {Array.from({ length: 19 }).map((_, i) => (
            <g key={i}>
              <line x1={`${(i + 1) * 5}`} y1="0" x2={`${(i + 1) * 5}`} y2="100" stroke="#C9C5BE" strokeWidth="0.25" />
              <line x1="0" y1={`${(i + 1) * 5}`} x2="100" y2={`${(i + 1) * 5}`} stroke="#C9C5BE" strokeWidth="0.25" />
            </g>
          ))}
          {/* Bold quarter-lines */}
          {[25, 50, 75].map(p => (
            <g key={p}>
              <line x1={`${p}`} y1="0" x2={`${p}`} y2="100" stroke="#B5B0A8" strokeWidth="0.5" />
              <line x1="0" y1={`${p}`} x2="100" y2={`${p}`} stroke="#B5B0A8" strokeWidth="0.5" />
            </g>
          ))}
          {/* Main walkway corridors */}
          <line x1={`${CORRIDOR_X}`} y1="0" x2={`${CORRIDOR_X}`} y2="100" stroke="#A09B93" strokeWidth="1" strokeDasharray="4 2" />
          <line x1="0" y1={`${CORRIDOR_Y}`} x2="100" y2={`${CORRIDOR_Y}`} stroke="#A09B93" strokeWidth="1" strokeDasharray="4 2" />

          {/* Navigation path — L-shaped route through corridors */}
          {destPos && (
            <>
              <polyline
                points={`${KIOSK.left},${KIOSK.top} ${KIOSK.left},${CORRIDOR_Y} ${destPos.left},${CORRIDOR_Y} ${destPos.left},${destPos.top}`}
                fill="none"
                stroke="#FF8A00"
                strokeWidth="1.8"
                strokeDasharray="4 2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
              <circle cx={destPos.left} cy={destPos.top} r="2.5" fill="#FF8A00" opacity={0.9} />
            </>
          )}
        </svg>

        {/* Vendor stall pins */}
        {stalls.map((stall, idx) => {
          const isSelected = selected?.id === stall.id;
          const gx = stall.grid_x ?? (idx % 5) * 2;
          const gy = stall.grid_y ?? Math.floor(idx / 5) * 2;
          const pos = gridToPct(gx, gy);
          const colorCls  = CATEGORY_COLORS[stall.category]  ?? CATEGORY_COLORS.Default;
          const borderCls = CATEGORY_BORDERS[stall.category] ?? CATEGORY_BORDERS.Default;

          return (
            <div
              key={stall.id}
              className="absolute cursor-pointer"
              style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: '8%', height: '10%', transform: 'translate(-50%,-50%)' }}
              onClick={() => setSelected(stall)}
            >
              {isSelected && (
                <div className="absolute inset-0 rounded-xl bg-orange-400/50 animate-ping pointer-events-none" />
              )}
              <div
                className={`w-full h-full border-[2.5px] rounded-xl flex flex-col items-center justify-center overflow-hidden relative transition-transform duration-150
                  ${isSelected
                    ? `${borderCls} shadow-xl ring-2 ring-orange-400/70 ring-offset-1 scale-110`
                    : `${borderCls} shadow-md active:scale-95`}`}
              >
                <div className={`absolute inset-0 ${colorCls} ${isSelected ? 'opacity-20' : 'opacity-10'}`} />
                {isSelected && (
                  <MapPin className="relative z-10 w-3 h-3 text-orange-500 fill-orange-500 animate-bounce mb-0.5" />
                )}
                <span className={`relative z-10 text-[9px] font-black leading-none ${isSelected ? 'text-orange-600' : 'text-gray-700'}`}>
                  {(stall.name ?? 'V')[0].toUpperCase()}
                </span>
              </div>
              {/* Name label */}
              <div className="absolute top-full mt-0.5 left-1/2 -translate-x-1/2 pointer-events-none z-10">
                <span className="text-[6px] font-semibold text-gray-600 bg-white/80 px-1 rounded whitespace-nowrap block text-center max-w-[60px] truncate">
                  {stall.name}
                </span>
              </div>
            </div>
          );
        })}

        {/* YOU ARE HERE pin */}
        <div
          className="absolute z-30 flex flex-col items-center pointer-events-none"
          style={{ left: `${KIOSK.left}%`, top: `${KIOSK.top}%`, transform: 'translate(-50%, -100%)' }}
        >
          <div className="w-12 h-12 rounded-full bg-blue-500 border-4 border-white shadow-2xl flex flex-col items-center justify-center">
            <span className="text-white text-[10px] font-black leading-none">YOU</span>
            <span className="text-white text-[7px] font-semibold leading-tight">are here</span>
          </div>
          {/* Triangle pointer */}
          <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-blue-500 -mt-px" />
          <span className="mt-1 text-[7px] font-bold text-blue-700 bg-white/90 px-2 py-0.5 rounded-full shadow whitespace-nowrap">
            {t.youAreHere}
          </span>
        </div>

        {/* Hint — shown when no stall is selected */}
        {!selected && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 bg-[#1A1A1A]/80 backdrop-blur-sm text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl whitespace-nowrap">
            {t.selectDestToView}
          </div>
        )}
      </div>

      {/* ── Bottom deck — slides up when a stall is tapped ─────────────────── */}
      <div
        className={`bg-white border-t border-gray-200 transition-all duration-300 overflow-hidden ${selected ? 'max-h-44' : 'max-h-0'}`}
      >
        {selected && (
          <div className="px-4 pt-4 pb-5 flex flex-col gap-3">
            {/* Stall summary row */}
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-xl ${CATEGORY_COLORS[selected.category] ?? CATEGORY_COLORS.Default} flex items-center justify-center shadow-sm shrink-0`}>
                <span className="text-white text-lg font-black">{(selected.name ?? 'V')[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{selected.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Zone {selected.zone} · {selected.category}</p>
                <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                  <span className="flex items-center gap-1"><Navigation className="w-3.5 h-3.5" /> {selected.distance}m {t.away}</span>
                  <span className="flex items-center gap-1"><Footprints className="w-3.5 h-3.5" /> ~{Math.ceil(selected.distance / 50)} min {t.walk}</span>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 p-1 shrink-0 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigate CTA */}
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-[#1A1A1A] hover:bg-gray-800 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
            >
              <Navigation className="w-5 h-5" />
              {t.navigateStall}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
