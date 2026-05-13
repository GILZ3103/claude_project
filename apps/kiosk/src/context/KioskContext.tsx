import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { getCard, getCampaigns, kioskTap, getMealSuggestion, updateCalorieLimit } from '../lib/api'
import toast from 'react-hot-toast'

export type KioskPanel =
  | 'home' | 'card' | 'calorie-set' | 'meal-suggestion'
  | 'food-browser' | 'map' | 'campaigns' | 'top-up'

interface KioskCard {
  uid: string
  owner_name: string
  points_balance: number
  calories_today: number
  calorie_limit: number
  checkpoints_today: string[]
  active_vouchers: any[]
}

interface SelectedStall {
  vendor_id: string
  business_name: string
  grid_x: number
  grid_y: number
}

interface KioskContextValue {
  panel: KioskPanel
  card: KioskCard | null
  campaigns: any[]
  tapping: boolean
  selectedStall: SelectedStall | null
  calorieInput: number
  suggestions: any[]
  showEmergency: boolean
  setPanel: (p: KioskPanel) => void
  setCalorieInput: (v: number) => void
  handleNfcTap: (uid: string) => Promise<void>
  handleKioskTap: () => Promise<void>
  handleSelectStall: (stall: SelectedStall) => void
  handleGetSuggestions: (budget: number) => Promise<void>
  handleSaveCalorieLimit: (limit: number) => Promise<void>
  toggleEmergency: () => void
  reset: () => void
}

const KioskContext = createContext<KioskContextValue | null>(null)

const KIOSK_ID = import.meta.env.VITE_KIOSK_ID ?? 'kiosk-01'

export function KioskProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<KioskPanel>('home')
  const [card, setCard] = useState<KioskCard | null>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [tapping, setTapping] = useState(false)
  const [selectedStall, setSelectedStall] = useState<SelectedStall | null>(null)
  const [calorieInput, setCalorieInput] = useState(1800)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showEmergency, setShowEmergency] = useState(false)

  async function handleNfcTap(uid: string) {
    try {
      const data = await getCard(uid) as KioskCard
      setCard(data)
      setCalorieInput(data.calorie_limit ?? 1800)
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
      const updated = await getCard(card.uid) as KioskCard
      setCard(updated)
    } catch (e: any) {
      toast.error(e.message ?? 'Tap failed')
    } finally {
      setTapping(false)
    }
  }

  function handleSelectStall(stall: SelectedStall) {
    setSelectedStall(stall)
    setPanel('map')
  }

  async function handleGetSuggestions(budget: number) {
    try {
      const res = await getMealSuggestion(budget) as any
      setSuggestions(res ?? [])
      setPanel('meal-suggestion')
    } catch (e: any) {
      toast.error('Could not get suggestions. Try again.')
    }
  }

  async function handleSaveCalorieLimit(limit: number) {
    if (!card) return
    try {
      await updateCalorieLimit(card.uid, limit)
      setCard({ ...card, calorie_limit: limit })
      toast.success('Calorie limit saved!')
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save limit')
    }
  }

  function toggleEmergency() {
    setShowEmergency(prev => !prev)
  }

  function reset() {
    setCard(null)
    setCampaigns([])
    setSelectedStall(null)
    setSuggestions([])
    setShowEmergency(false)
    setPanel('home')
  }

  return (
    <KioskContext.Provider value={{
      panel, card, campaigns, tapping,
      selectedStall, calorieInput, suggestions, showEmergency,
      setPanel, setCalorieInput,
      handleNfcTap, handleKioskTap,
      handleSelectStall, handleGetSuggestions, handleSaveCalorieLimit,
      toggleEmergency, reset
    }}>
      {children}
    </KioskContext.Provider>
  )
}

export function useKiosk() {
  const ctx = useContext(KioskContext)
  if (!ctx) throw new Error('useKiosk must be used within KioskProvider')
  return ctx
}
