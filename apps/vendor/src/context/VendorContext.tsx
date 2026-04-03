import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { loginVendor, getCard } from '../lib/api'

interface VendorCard {
  uid: string
  owner_name: string
  owner_email: string
  phone_number: string
  role: string
  vendor_id: string | null
  business_name: string | null
}

interface VendorContextValue {
  card: VendorCard | null
  vendorId: string | null
  loading: boolean
  error: string | null
  login: (uid: string, password: string) => Promise<void>
  logout: () => void
  setVendorId: (id: string) => void
}

const VendorContext = createContext<VendorContextValue | null>(null)

export function VendorProvider({ children }: { children: ReactNode }) {
  const [card, setCard] = useState<VendorCard | null>(null)
  const [vendorId, setVendorIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore session on mount (no re-auth — password not stored)
  useEffect(() => {
    const uid = localStorage.getItem('vendor_card_uid')
    const vid = localStorage.getItem('vendor_id')
    if (uid) restoreSession(uid, vid)
  }, [])

  async function restoreSession(uid: string, vid: string | null) {
    setLoading(true)
    try {
      const data = await getCard(uid) as any
      if (data.role !== 'VENDOR') throw new Error('Not a vendor card')
      // Vendor ID from localStorage or from login response
      const resolvedVid = vid ?? null
      setCard({ ...data, vendor_id: resolvedVid, business_name: null })
      setVendorIdState(resolvedVid)
    } catch {
      // Session stale — clear it
      localStorage.removeItem('vendor_card_uid')
      localStorage.removeItem('vendor_id')
      setCard(null)
      setVendorIdState(null)
    } finally {
      setLoading(false)
    }
  }

  async function login(uid: string, password: string) {
    setLoading(true)
    setError(null)
    try {
      const data = await loginVendor(uid, password) as VendorCard
      localStorage.setItem('vendor_card_uid', uid)
      if (data.vendor_id) {
        localStorage.setItem('vendor_id', data.vendor_id)
        setVendorIdState(data.vendor_id)
      }
      setCard(data)
    } catch (e: any) {
      setError(e.message ?? 'Login failed')
      setCard(null)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    setCard(null)
    setVendorIdState(null)
    localStorage.removeItem('vendor_card_uid')
    localStorage.removeItem('vendor_id')
  }

  function setVendorId(id: string) {
    setVendorIdState(id)
    localStorage.setItem('vendor_id', id)
    if (card) setCard({ ...card, vendor_id: id })
  }

  return (
    <VendorContext.Provider value={{ card, vendorId, loading, error, login, logout, setVendorId }}>
      {children}
    </VendorContext.Provider>
  )
}

export function useVendor() {
  const ctx = useContext(VendorContext)
  if (!ctx) throw new Error('useVendor must be used within VendorProvider')
  return ctx
}
