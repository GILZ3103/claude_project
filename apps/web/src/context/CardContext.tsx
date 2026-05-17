import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { getCard } from '../lib/api'

interface Voucher {
  voucher_id: string
  discount_value: number
  applicable_vendor_ids: string[] | null
  expires_at: string | null
}

interface CardSession {
  uid: string
  owner_name: string
  owner_email: string
  phone_number: string | null
  role: 'CONSUMER' | 'VENDOR' | 'ADMIN'
  points_balance: number
  calorie_limit: number
  calories_today: number
  checkpoints_today: string[]
  active_vouchers: Voucher[]
  photo_url: string | null
  // Vendor fields (only populated when role === 'VENDOR')
  vendor_id: string | null
  business_name: string | null
  ssm_registration_number: string | null
  grid_x: number | null
  grid_y: number | null
  application_status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | null
  rejection_reason: string | null
  // Admin fields (only populated when role === 'ADMIN')
  authority_id: string | null
  department: string | null
}

interface CardContextValue {
  card: CardSession | null
  loading: boolean
  error: string | null
  setSessionFromLogin: (data: any) => void
  refreshCard: () => Promise<void>
  unlinkCard: () => void
}

const CardContext = createContext<CardContextValue | null>(null)

export function CardProvider({ children }: { children: ReactNode }) {
  const [card, setCard] = useState<CardSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('linked_card_uid')
    if (stored) restoreSession(stored)
  }, [])

  async function restoreSession(uid: string) {
    setLoading(true)
    try {
      const data = await getCard(uid) as CardSession
      setCard(data)
    } catch {
      localStorage.removeItem('linked_card_uid')
      setCard(null)
    } finally {
      setLoading(false)
    }
  }

  function setSessionFromLogin(data: any) {
    // Fill defaults for fields not returned by login endpoints to prevent render crashes
    const fullData: CardSession = {
      points_balance: 0,
      calorie_limit: 2000,
      calories_today: 0,
      checkpoints_today: [],
      active_vouchers: [],
      vendor_id: null,
      business_name: null,
      ssm_registration_number: null,
      grid_x: null,
      grid_y: null,
      application_status: null,
      rejection_reason: null,
      authority_id: null,
      department: null,
      ...data,
    }
    localStorage.setItem('linked_card_uid', data.uid)
    setCard(fullData)
    setError(null)
    // Refresh from full /api/cards/:uid to get vouchers, calories, etc.
    if (data.role === 'CONSUMER' || data.role === 'VENDOR') {
      restoreSession(data.uid)
    }
  }

  async function refreshCard() {
    if (card?.uid) await restoreSession(card.uid)
  }

  function unlinkCard() {
    setCard(null)
    localStorage.removeItem('linked_card_uid')
    localStorage.removeItem('app_mode')
  }

  return (
    <CardContext.Provider value={{ card, loading, error, setSessionFromLogin, refreshCard, unlinkCard }}>
      {children}
    </CardContext.Provider>
  )
}

export function useCard() {
  const ctx = useContext(CardContext)
  if (!ctx) throw new Error('useCard must be used within CardProvider')
  return ctx
}
