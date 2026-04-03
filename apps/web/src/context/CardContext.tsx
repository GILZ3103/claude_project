import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
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
  points_balance: number
  calorie_limit: number
  calories_today: number
  checkpoints_today: string[]
  active_vouchers: Voucher[]
}

interface CardContextValue {
  card: CardSession | null
  loading: boolean
  error: string | null
  loginCard: (uid: string, password: string) => Promise<void>
  refreshCard: () => Promise<void>
  unlinkCard: () => void
}

const CardContext = createContext<CardContextValue | null>(null)

export function CardProvider({ children }: { children: ReactNode }) {
  const [card, setCard] = useState<CardSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore session from localStorage on mount (no re-auth needed after first login)
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

  async function loginCard(uid: string, password: string) {
    setLoading(true)
    setError(null)
    try {
      const data = await loginConsumer(uid, password) as CardSession
      localStorage.setItem('linked_card_uid', uid)
      // Fetch full profile (includes calories_today etc.)
      const full = await getCard(uid) as CardSession
      setCard(full)
    } catch (e: any) {
      setError(e.message ?? 'Login failed')
      setCard(null)
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
