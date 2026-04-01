import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getCard } from '../lib/api'

interface VendorCard {
  uid: string
  owner_name: string
  owner_email: string
  points_balance: number
  role: string
}

interface VendorContextValue {
  card: VendorCard | null
  vendorId: string | null
  loading: boolean
  error: string | null
  login: (uid: string) => Promise<void>
  logout: () => void
  setVendorId: (id: string) => void
}

const VendorContext = createContext<VendorContextValue | null>(null)

export function VendorProvider({ children }: { children: ReactNode }) {
  const [card, setCard] = useState<VendorCard | null>(null)
  const [vendorId, setVendorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore session
  useEffect(() => {
    const uid = localStorage.getItem('vendor_card_uid')
    const vid = localStorage.getItem('vendor_id')
    if (uid) login(uid)
    if (vid) setVendorId(vid)
  }, [])

  async function login(uid: string) {
    setLoading(true)
    setError(null)
    try {
      const data = await getCard(uid) as VendorCard
      if (data.role !== 'VENDOR') throw new Error('Card does not have VENDOR role')
      setCard(data)
      localStorage.setItem('vendor_card_uid', uid)
    } catch (e: any) {
      setError(e.message ?? 'Login failed')
      setCard(null)
      localStorage.removeItem('vendor_card_uid')
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    setCard(null)
    setVendorId(null)
    localStorage.removeItem('vendor_card_uid')
    localStorage.removeItem('vendor_id')
  }

  function handleSetVendorId(id: string) {
    setVendorId(id)
    localStorage.setItem('vendor_id', id)
  }

  return (
    <VendorContext.Provider value={{ card, vendorId, loading, error, login, logout, setVendorId: handleSetVendorId }}>
      {children}
    </VendorContext.Provider>
  )
}

export function useVendor() {
  const ctx = useContext(VendorContext)
  if (!ctx) throw new Error('useVendor must be used within VendorProvider')
  return ctx
}
