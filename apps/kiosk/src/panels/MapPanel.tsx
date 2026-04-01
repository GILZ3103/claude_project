// Panel 4 — Night Market Map
// Figma design to be applied via MCP
import { useEffect, useState } from 'react'
import { getMap } from '../lib/api'
import { useKiosk } from '../context/KioskContext'

const CELL = 64

export default function MapPanel() {
  const { setPanel, card } = useKiosk()
  const [mapData, setMapData] = useState<any | null>(null)
  const [tooltip, setTooltip] = useState<any | null>(null)

  useEffect(() => {
    getMap().then(setMapData).catch(() => {})
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white p-8 overflow-y-auto">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Stall Map</h2>
        <button
          onClick={() => setPanel(card ? 'card' : 'idle')}
          className="text-sm text-gray-400 underline"
        >
          ← Back
        </button>
      </div>

      {!mapData && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-48 h-48 bg-white/10 rounded-xl animate-pulse" />
        </div>
      )}

      {mapData && (() => {
        const cols: number = mapData.grid_size?.cols ?? 10
        const rows: number = mapData.grid_size?.rows ?? 10

        return (
          <div className="overflow-auto flex-1">
            <div
              className="relative border border-white/10 rounded-xl bg-white/5"
              style={{ width: cols * CELL, height: rows * CELL }}
            >
              {Array.from({ length: rows }).map((_, r) =>
                Array.from({ length: cols }).map((_, c) => (
                  <div
                    key={`${r}-${c}`}
                    className="absolute border border-white/5"
                    style={{ left: c * CELL, top: r * CELL, width: CELL, height: CELL }}
                  />
                ))
              )}

              {mapData.kiosks?.map((k: any) => (
                <button
                  key={k.kiosk_id}
                  onClick={() => setTooltip(tooltip?.kiosk_id === k.kiosk_id ? null : { ...k, _type: 'kiosk' })}
                  className="absolute flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500 text-white text-sm font-bold shadow"
                  style={{
                    left: (k.grid_x ?? 0) * CELL + (CELL - 48) / 2,
                    top: (k.grid_y ?? 0) * CELL + (CELL - 48) / 2,
                  }}
                >
                  K
                </button>
              ))}

              {mapData.vendors?.map((v: any) => (
                <button
                  key={v.vendor_id}
                  onClick={() => setTooltip(tooltip?.vendor_id === v.vendor_id ? null : { ...v, _type: 'vendor' })}
                  className="absolute flex items-center justify-center w-12 h-12 rounded-xl bg-green-500 text-white text-sm font-bold shadow"
                  style={{
                    left: (v.grid_x ?? 0) * CELL + (CELL - 48) / 2,
                    top: (v.grid_y ?? 0) * CELL + (CELL - 48) / 2,
                  }}
                >
                  {(v.business_name ?? 'V')[0]}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {tooltip && (
        <div className="mt-4 bg-white/10 rounded-2xl p-4">
          <p className="font-semibold">
            {tooltip._type === 'vendor' ? tooltip.business_name : (tooltip.label ?? 'Kiosk')}
          </p>
          <p className="text-xs text-gray-400">
            {tooltip._type === 'vendor' ? tooltip.category : 'Directory Kiosk'}
            {' · '}Grid ({tooltip.grid_x}, {tooltip.grid_y})
          </p>
        </div>
      )}

      <div className="flex gap-4 text-xs text-gray-500 mt-4">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-500 inline-block" /> Vendor
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Kiosk
        </span>
      </div>
    </div>
  )
}
