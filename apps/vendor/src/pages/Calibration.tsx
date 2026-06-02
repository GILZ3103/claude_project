import { useEffect, useState } from 'react'
import { useVendor } from '../context/VendorContext'
import { getCalibration, saveCalibration } from '../lib/api'
import toast from 'react-hot-toast'

export default function Calibration() {
  const { vendorId } = useVendor()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ scale_factor: '', tare_offset: '' })
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    if (vendorId) load()
  }, [vendorId])

  async function load() {
    setLoading(true)
    try {
      const data = await getCalibration(vendorId!) as any
      if (data) {
        setForm({
          scale_factor: String(data.scale_factor),
          tare_offset: String(data.tare_offset),
        })
        setLastUpdated(data.updated_at)
      }
    } catch {
      // no calibration yet — leave form blank
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!vendorId) return
    const sf = parseFloat(form.scale_factor)
    const to = parseInt(form.tare_offset, 10)
    if (isNaN(sf) || sf <= 0) { toast.error('Scale factor must be a positive number'); return }
    if (isNaN(to)) { toast.error('Tare offset must be an integer'); return }
    setSaving(true)
    try {
      const data = await saveCalibration(vendorId, sf, to) as any
      setLastUpdated(data.updated_at)
      toast.success('Calibration saved')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!vendorId) return <div className="p-6 text-center text-gray-400">No vendor linked.</div>

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5 pb-24">
      <div>
        <h1 className="text-xl font-bold">Terminal Calibration</h1>
        <p className="text-sm text-gray-500 mt-1">Configure your load cell so the terminal converts ADC readings to grams accurately.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-sm text-amber-800">
        <p className="font-medium">How to get these values</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Power on the terminal with nothing on the scale — record the ADC reading as <strong>Tare Offset</strong>.</li>
          <li>Place a known weight (e.g. 200 g) on the scale — record the new ADC reading.</li>
          <li><strong>Scale Factor</strong> = known weight &divide; (ADC reading &minus; tare offset).</li>
        </ol>
        <p className="text-xs text-amber-600">Example: known = 200 g, tare = 1024, loaded ADC = 49424 &rarr; scale_factor = 200 &divide; (49424 &minus; 1024) = 0.004132</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-white rounded-xl shadow p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Scale Factor (g / ADC unit)</label>
            <input
              required
              type="number"
              step="any"
              className="w-full border rounded-lg px-4 py-2 text-sm"
              placeholder="e.g. 0.004132"
              value={form.scale_factor}
              onChange={e => setForm(p => ({ ...p, scale_factor: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tare Offset (ADC at zero load)</label>
            <input
              required
              type="number"
              step="1"
              className="w-full border rounded-lg px-4 py-2 text-sm"
              placeholder="e.g. 1024"
              value={form.tare_offset}
              onChange={e => setForm(p => ({ ...p, tare_offset: e.target.value }))}
            />
          </div>

          {lastUpdated && (
            <p className="text-xs text-gray-400">
              Last saved: {new Date(lastUpdated).toLocaleString()}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-black text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Calibration'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow p-4 space-y-2">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Weight Formula</p>
        <p className="text-sm font-mono bg-gray-50 rounded-lg p-3">
          weight_g = (ADC_reading &minus; tare_offset) &times; scale_factor
        </p>
        <p className="text-xs text-gray-400">
          This formula runs in the ESP32 firmware. The result is sent as <code className="bg-gray-100 px-1 rounded">weight_g</code> in each tap event.
        </p>
      </div>
    </div>
  )
}
