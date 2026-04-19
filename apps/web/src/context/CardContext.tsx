import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { getCard, loginConsumer } from '../lib/api'

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
  phone_number: string
  role: string
  points_balance: number
  calorie_limit: number
  calories_today: number
  checkpoints_today: string[]
  active_vouchers: Voucher[]
  // Vendor fields (only populated when role === 'VENDOR')
  vendor_id: string | null
  business_name: string | null
  ssm_registration_number: string | null
  grid_x: number | null
  grid_y: number | null
}

interface CardContextValue {
  card: CardSession | null
  loading: boolean
  error: string | null
  loginCard: (email: string, password: string) => Promise<boolean>
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

  async function loginCard(email: string, password: string): Promise<boolean> {
    setLoading(true)
    setError(null)
    try {
      const data = await loginConsumer(email, password) as CardSession
      localStorage.setItem('linked_card_uid', data.uid)
      const full = await getCard(data.uid) as CardSession
      setCard(full)
      return true
    } catch (e: any) {
      setError(e.message ?? 'Login failed')
      setCard(null)
      return false
    } finally {
      setLoading(false)
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
    <CardContext.Provider value={{ card, loading, error, loginCard, refreshCard, unlinkCard }}>
      {children}
    </CardContext.Provider>
  )
}

export function useCard() {
  const ctx = useContext(CardContext)
  if (!ctx) throw new Error('useCard must be used within CardProvider')
  return ctx
}
