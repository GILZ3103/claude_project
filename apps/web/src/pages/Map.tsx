// Map — Figma design to be applied via MCP
import { useEffect, useState } from 'react'
import { getMap } from '../lib/api'
import toast from 'react-hot-toast'

const CELL = 56 // px per grid cell

export default function Map() {
  const [mapData, setMapData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<any | null>(null)

  useEffect(() => {
    getMap()
      .then((data: any) => setMapData(data))
      .catch(() => toast.error('Failed to load map'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="w-64 h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!mapData) return null

  const { grid_size, vendors, kiosks } = mapData
  const cols: number = grid_size?.cols ?? 10
  const rows: number = grid_size?.rows ?? 10

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      {/* FIGMA DESIGN APPLIED HERE VIA MCP */}
      <h2 className="text-lg font-bold">Night Market Map</h2>

      <div className="overflow-auto">
        <div
          className="relative border border-gray-200 rounded-xl bg-gray-50"
          style={{ width: cols * CELL, height: rows * CELL }}
        >
          {/* Grid lines */}
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => (
              <div
                key={`${r}-${c}`}
                className="absolute border border-gray-100"
                style={{ left: c * CELL, top: r * CELL, width: CELL, height: CELL }}
              />
            ))
          )}

          {/* Kiosks */}
          {kiosks?.map((k: any) => (
            <button
              key={k.kiosk_id}
              onClick={() => setTooltip(tooltip?.kiosk_id === k.kiosk_id ? null : { ...k, _type: 'kiosk' })}
              className="absolute flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500 text-white text-xs font-bold shadow"
              style={{
                left: (k.grid_x ?? 0) * CELL + (CELL - 40) / 2,
                top: (k.grid_y ?? 0) * CELL + (CELL - 40) / 2,
              }}
              title={k.label}
            >
              K
            </button>
          ))}

          {/* Vendors */}
          {vendors?.map((v: any) => (
            <button
              key={v.vendor_id}
              onClick={() => setTooltip(tooltip?.vendor_id === v.vendor_id ? null : { ...v, _type: 'vendor' })}
              className="absolute flex items-center justify-center w-10 h-10 rounded-lg bg-green-500 text-white text-xs font-bold shadow"
              style={{
                left: (v.grid_x ?? 0) * CELL + (CELL - 40) / 2,
                top: (v.grid_y ?? 0) * CELL + (CELL - 40) / 2,
              }}
              title={v.business_name}
            >
              {(v.business_name ?? 'V')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Tooltip / info panel */}
      {tooltip && (
        <div className="bg-white rounded-xl shadow p-4">
          {tooltip._type === 'vendor' ? (
            <>
              <p className="font-semibold">{tooltip.business_name}</p>
              <p className="text-xs text-gray-400">{tooltip.category}</p>
              {tooltip.description && <p className="text-sm text-gray-500 mt-1">{tooltip.description}</p>}
              <p className="text-xs text-gray-400 mt-1">Grid ({tooltip.grid_x}, {tooltip.grid_y})</p>
            </>
          ) : (
            <>
              <p className="font-semibold">{tooltip.label ?? 'Kiosk'}</p>
              <p className="text-xs text-gray-400">Directory Kiosk</p>
              <p className="text-xs text-gray-400 mt-1">Grid ({tooltip.grid_x}, {tooltip.grid_y})</p>
            </>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
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
