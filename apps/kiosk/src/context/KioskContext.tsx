import { createContext, useContext, useState, ReactNode } from 'react'
import { getCard, getCampaigns, kioskTap } from '../lib/api'
import toast from 'react-hot-toast'

export type KioskPanel = 'idle' | 'card' | 'campaigns' | 'map'

interface KioskCard {
  uid: string
  owner_name: string
  points_balance: number
  calories_today: number
  calorie_limit: number
  checkpoints_today: string[]
  active_vouchers: any[]
}

interface KioskContextValue {
  panel: KioskPanel
  card: KioskCard | null
  campaigns: any[]
  tapping: boolean
  setPanel: (p: KioskPanel) => void
  handleNfcTap: (uid: string) => Promise<void>
  handleKioskTap: () => Promise<void>
  reset: () => void
}

const KioskContext = createContext<KioskContextValue | null>(null)

const KIOSK_ID = import.meta.env.VITE_KIOSK_ID ?? 'kiosk-01'

export function KioskProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<KioskPanel>('idle')
  const [card, setCard] = useState<KioskCard | null>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [tapping, setTapping] = useState(false)

  async function handleNfcTap(uid: string) {
    try {
      const data = await getCard(uid) as KioskCard
      setCard(data)
      const res = await getCampaigns(uid) as any
      setCampaigns(res.campaigns ?? res ?? [])
      setPanel('card')
    } catch (e: any) {
      toast.error(e.message ?? 'Card not found')
    }
  }

  async function handleKioskTap() {
    if (!card) return
    setTapping(true)
    try {
      await kioskTap(card.uid, KIOSK_ID, new Date().toISOString())
      toast.success('Directory rebate applied!')
      // Refresh card
      const updated = await getCard(card.uid) as KioskCard
      setCard(updated)
      setPanel('campaigns')
    } catch (e: any) {
      toast.error(e.message ?? 'Tap failed')
    } finally {
      setTapping(false)
    }
  }

  function reset() {
    setCard(null)
    setCampaigns([])
    setPanel('idle')
  }

  return (
    <KioskContext.Provider value={{ panel, card, campaigns, tapping, setPanel, handleNfcTap, handleKioskTap, reset }}>
      {children}
    </KioskContext.Provider>
  )
}

export function useKiosk() {
  const ctx = useContext(KioskContext)
  if (!ctx) throw new Error('useKiosk must be used within KioskProvider')
  return ctx
}
