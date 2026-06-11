import { useState } from 'react';
import { X, Navigation, MapPin, Footprints, ZoomIn, ZoomOut } from 'lucide-react';
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

// Maps grid coords (0–10) into the vendor zone (top-left 25%×30% of the map canvas)
function gridToPct(gx: number, gy: number) {
  return {
    left: Math.min(23, Math.max(3, (gx / 10) * 22 + 2)),
    top: Math.min(27, Math.max(3, (gy / 10) * 24 + 2)),
  }
}

export function SmartNav({ destination, stalls, onClose, language }: SmartNavProps) {
  const t = translations[language];
  const [scale, setScale] = useState(1);
  const destPos = destination ? gridToPct(destination.grid_x ?? 5, destination.grid_y ?? 5) : null;

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 2));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-full max-h-[520px] flex overflow-hidden shadow-2xl relative">

        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-md text-gray-500 hover:text-black hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left: Map Area */}
        <div className="flex-1 bg-[#EEE9E0] relative flex items-center justify-center overflow-hidden">
          {/* Zoom controls */}
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
            <button onClick={handleZoomIn} className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-black hover:bg-gray-50"><ZoomIn className="w-5 h-5"/></button>
            <button onClick={handleZoomOut} className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-black hover:bg-gray-50"><ZoomOut className="w-5 h-5"/></button>
          </div>

          {/* Map canvas */}
          <div
            className="relative transition-transform duration-300 ease-out"
            style={{ transform: `scale(${scale})`, width: '100%', height: '100%' }}
          >
            {/* 20×20 SVG grid + vendor zone boundary — matches web Map.tsx */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {Array.from({ length: 19 }).map((_, i) => (
                <g key={i}>
                  <line x1={`${(i + 1) * 5}`} y1="0" x2={`${(i + 1) * 5}`} y2="100" stroke="#C9C5BE" strokeWidth="0.25" />
                  <line x1="0" y1={`${(i + 1) * 5}`} x2="100" y2={`${(i + 1) * 5}`} stroke="#C9C5BE" strokeWidth="0.25" />
                </g>
              ))}
              {[25, 50, 75].map(p => (
                <g key={p}>
                  <line x1={`${p}`} y1="0" x2={`${p}`} y2="100" stroke="#B5B0A8" strokeWidth="0.5" />
                  <line x1="0" y1={`${p}`} x2="100" y2={`${p}`} stroke="#B5B0A8" strokeWidth="0.5" />
                </g>
              ))}
              {/* Vendor zone boundary — top-left 25%×30% */}
              <rect x="1" y="1" width="24" height="29" fill="rgba(255,138,0,0.06)" stroke="#FF8A00" strokeWidth="0.6" strokeDasharray="2.5 1.5" rx="1" />
              {/* Main walkways */}
              <line x1="25" y1="0" x2="25" y2="100" stroke="#A09B93" strokeWidth="1" strokeDasharray="4 2" />
              <line x1="0" y1="30" x2="100" y2="30" stroke="#A09B93" strokeWidth="1" strokeDasharray="4 2" />
              {/* Navigation path: kiosk → horizontal walkway → vertical walkway → stall */}
              {destPos && (
                <path
                  key={destination!.id}
                  d={`M 50 92 L 50 30 L 25 30 L 25 ${destPos.top} L ${destPos.left} ${destPos.top}`}
                  fill="none"
                  stroke="#E8622A"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="anim-draw-path"
                />
              )}
            </svg>

            {/* Zone label */}
            <div className="absolute pointer-events-none z-10" style={{ left: '1%', top: '31%' }}>
              <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400 bg-[#EEE9E0]/80 px-1.5 py-0.5 rounded">
                Vendor Zone
              </span>
            </div>

            {/* Vendor stall pins */}
            {stalls.map((stall, idx) => {
              const isDest = destination?.id === stall.id;
              const gx = stall.grid_x ?? 0;
              const gy = stall.grid_y ?? 0;
              const pos = stall.grid_x != null
                ? gridToPct(gx, gy)
                : { left: (idx % 5) * 4.5 + 2.5, top: Math.floor(idx / 5) * 5.5 + 3 };
              const colorCls = CATEGORY_COLORS[stall.category] ?? CATEGORY_COLORS.Default;
              const borderCls = CATEGORY_BORDERS[stall.category] ?? CATEGORY_BORDERS.Default;

              return (
                <div
                  key={stall.id}
                  className="absolute"
                  style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: '8%', height: '10%', transform: 'translate(-50%,-50%)' }}
                >
                  {isDest && (
                    <div className="absolute inset-0 rounded-xl bg-orange-400/50 animate-ping pointer-events-none" />
                  )}
                  <div className={`w-full h-full border-[2.5px] rounded-xl flex flex-col items-center justify-center overflow-hidden relative cursor-default
                    ${isDest ? `${borderCls} shadow-xl ring-2 ring-orange-400/70 ring-offset-1 scale-110` : `${borderCls} shadow-md`}`}
                  >
                    <div className={`absolute inset-0 ${colorCls} ${isDest ? 'opacity-20' : 'opacity-10'}`} />
                    {isDest && <MapPin className="relative z-10 w-3 h-3 text-orange-500 fill-orange-500 animate-bounce mb-0.5" />}
                    <span className={`relative z-10 text-[9px] font-black leading-none ${isDest ? 'text-orange-600' : 'text-gray-700'}`}>
                      {(stall.name ?? 'V')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="absolute top-full mt-0.5 left-1/2 -translate-x-1/2 pointer-events-none z-10">
                    <span className="text-[6px] font-semibold text-gray-600 bg-white/80 px-1 rounded whitespace-nowrap block text-center max-w-[60px] truncate">
                      {stall.name}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* YOU ARE HERE — static blue dot (no BLE on kiosk) */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-30 pointer-events-none">
              <div className="w-5 h-5 bg-blue-500 rounded-full border-4 border-white shadow-md animate-pulse" />
              <span className="text-[10px] font-bold mt-1 text-blue-700 bg-white px-3 py-1 rounded-full shadow-md border border-blue-100">
                {t.youAreHere}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Directions Panel */}
        <div className="w-80 bg-white border-l border-gray-200 p-6 flex flex-col">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.directions}</h2>

          {destination ? (
            <>
              <div className="mb-6 p-4 bg-orange-50 rounded-xl border border-orange-100">
                <h3 className="font-bold text-orange-800 mb-1">{destination.name}</h3>
                <p className="text-sm text-orange-600 font-medium">Zone {destination.zone} • {destination.category}</p>
                <div className="flex items-center gap-4 mt-3 text-sm font-semibold text-orange-700">
                  <div className="flex items-center gap-1"><Navigation className="w-4 h-4" /> {destination.distance}m</div>
                  <div className="flex items-center gap-1"><Footprints className="w-4 h-4" /> ~{Math.ceil(destination.distance / 50)} min</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pb-6">
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white" />
                    <p className="font-bold text-gray-900 text-sm">{t.startKiosk}</p>
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-gray-300 border-2 border-white" />
                    <p className="font-bold text-gray-900 text-sm">{t.goStraight}</p>
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-gray-300 border-2 border-white" />
                    <p className="font-bold text-gray-900 text-sm">{t.turnLeft}</p>
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-orange-500 border-2 border-white shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                    <p className="font-bold text-orange-600 text-sm">{t.arriveAt} {destination.name}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-center">
              {t.selectDestToView}
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full mt-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
          >
            {t.done}
          </button>
        </div>
      </div>
    </div>
  );
}
