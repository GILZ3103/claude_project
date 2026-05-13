import { useEffect, useState } from 'react'
import { getMap } from '../lib/api'
import { useKiosk } from '../context/KioskContext'

const CELL = 56

export default function MapPanel() {
  const { card, selectedStall, setPanel, toggleEmergency } = useKiosk()
  const [mapData, setMapData] = useState<any | null>(null)
  const [tooltip, setTooltip] = useState<any | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    getMap()
      .then((data: any) => {
        setMapData(data)
        if (selectedStall) {
          const match = data?.vendors?.find((v: any) => v.vendor_id === selectedStall.vendor_id)
          if (match) setTooltip({ ...match, _type: 'vendor' })
        }
      })
      .catch(() => setError(true))
  }, [])

  const cols: number = mapData?.grid_size?.cols ?? 10
  const rows: number = mapData?.grid_size?.rows ?? 8

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
        <button
          onClick={() => setPanel(card ? 'card' : 'home')}
          className="text-gray-500 text-sm underline"
        >
          ← Back
        </button>
        <button onClick={toggleEmergency} className="text-red-400 text-sm font-medium">🚨 Help</button>
      </div>

      <div className="px-6 pb-3 shrink-0">
        <h2 className="text-xl font-bold">Stall Map</h2>
        {selectedStall && (
          <p className="text-sm text-yellow-400 mt-1">
            📍 Navigating to: <span className="font-semibold">{selectedStall.business_name}</span>
          </p>
        )}
      </div>

      {/* Loading */}
      {!mapData && !error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-40 h-40 bg-white/10 rounded-xl animate-pulse" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Could not load map. Check your connection.
        </div>
      )}

      {/* Grid */}
      {mapData && (
        <div className="flex-1 overflow-auto px-4">
          <div
            className="relative border border-white/10 rounded-xl bg-white/5"
            style={{ width: cols * CELL, height: rows * CELL, minWidth: cols * CELL }}
          >
            {/* Grid lines */}
            {Array.from({ length: rows }, (_, r) =>
              Array.from({ length: cols }, (_, c) => (
                <div
                  key={`cell-${r}-${c}`}
                  className="absolute border border-white/5"
                  style={{ left: c * CELL, top: r * CELL, width: CELL, height: CELL }}
                />
              ))
            )}

            {/* Kiosks */}
            {(mapData.kiosks ?? []).map((k: any) => (
              <button
                key={k.kiosk_id}
                onClick={() => setTooltip(tooltip?.kiosk_id === k.kiosk_id ? null : { ...k, _type: 'kiosk' })}
                className="absolute flex items-center justify-center rounded-xl bg-blue-500 text-white text-xs font-bold shadow"
                style={{ left: (k.grid_x ?? 0) * CELL + 4, top: (k.grid_y ?? 0) * CELL + 4, width: CELL - 8, height: CELL - 8 }}
              >
                K
              </button>
            ))}

            {/* Vendors */}
            {(mapData.vendors ?? []).map((v: any) => {
              const isHighlighted = selectedStall?.vendor_id === v.vendor_id
              return (
                <button
                  key={v.vendor_id}
                  onClick={() => setTooltip(tooltip?.vendor_id === v.vendor_id ? null : { ...v, _type: 'vendor' })}
                  className={`absolute flex items-center justify-center rounded-xl text-white text-xs font-bold shadow transition-all ${
                    isHighlighted
                      ? 'bg-yellow-400 text-gray-900 ring-2 ring-yellow-300 scale-110'
                      : 'bg-green-500'
                  }`}
                  style={{ left: (v.grid_x ?? 0) * CELL + 4, top: (v.grid_y ?? 0) * CELL + 4, width: CELL - 8, height: CELL - 8 }}
                >
                  {(v.business_name ?? 'V')[0]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div className="mx-4 mt-2 bg-white/10 rounded-2xl p-3 shrink-0">
          <p className="font-semibold text-sm">
            {tooltip._type === 'vendor' ? tooltip.business_name : (tooltip.label ?? 'Kiosk')}
          </p>
          <p className="text-xs text-gray-400">
            {tooltip._type === 'vendor' ? tooltip.category : 'Directory Kiosk'} · Grid ({tooltip.grid_x}, {tooltip.grid_y})
          </p>
          {tooltip._type === 'vendor' && selectedStall?.vendor_id === tooltip.vendor_id && (
            <p className="text-yellow-400 text-xs mt-1 font-medium">← Your destination</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500 px-4 py-3 shrink-0">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Vendor</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400 inline-block" /> Destination</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Kiosk</span>
      </div>
    </div>
  )
}
