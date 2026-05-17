import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { CardProvider, useCard } from './context/CardContext'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Calories from './pages/Calories'
import Campaigns from './pages/Campaigns'
import Vendors from './pages/Vendors'
import Map from './pages/Map'
import NfcConnect from './pages/NfcConnect'
import Settings from './pages/Settings'
import VendorDashboard from './pages/VendorDashboard'
import VendorInformation from './pages/VendorInformation'
import VendorClaim from './pages/VendorClaim'
import VendorSummary from './pages/VendorSummary'
import Vouchers from './pages/Vouchers'
import AiChat from './components/AiChat'
import { TopNav } from './components/TopNav'

type AppMode = 'consumer' | 'vendor'

function AppLayout({ mode, setMode }: { mode: AppMode; setMode: (m: AppMode) => void }) {
  const { pathname } = useLocation()
  const { card } = useCard()
  const onAuthPage = pathname === '/'
  const showTopNav = !onAuthPage && !!card
  const showAiChat = showTopNav && card?.role !== 'ADMIN'

  return (
    <div className={`min-h-screen bg-gray-50 ${showTopNav ? 'pt-14' : ''}`}>
      {showTopNav && <TopNav mode={mode} setMode={setMode} />}
      {showAiChat && <AiChat />}
      <Routes>
        <Route path="/" element={<Auth />} />
        {/* Consumer routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/calories" element={<Calories />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/map" element={<Map />} />
        <Route path="/nfc" element={<NfcConnect />} />
        <Route path="/vouchers" element={<Vouchers />} />
        <Route path="/settings" element={<Settings />} />
        {/* Vendor routes */}
        <Route path="/vendor/dashboard" element={<VendorDashboard />} />
        <Route path="/vendor/information" element={<VendorInformation />} />
        <Route path="/vendor/campaigns" element={<Campaigns />} />
        <Route path="/vendor/claim" element={<VendorClaim />} />
        <Route path="/vendor/summary" element={<VendorSummary />} />
        {/* Admin route */}
        <Route path="/admin" element={<AdminPlaceholder />} />
      </Routes>
    </div>
  )
}

function AdminPlaceholder() {
  const { card, unlinkCard } = useCard()
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAFAFA]">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
        <div className="w-12 h-12 mx-auto bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
          🛡️
        </div>
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-gray-500">Signed in as <strong>{card?.owner_name}</strong></p>
        <p className="text-xs text-gray-400">{card?.department}</p>
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          Full admin dashboard coming in Phase 3 — vendor approval, slot allocation, compliance review.
        </p>
        <button onClick={unlinkCard} className="text-sm text-red-500 hover:underline">Sign out</button>
      </div>
    </div>
  )
}

function ServerWakeBanner() {
  const [show, setShow] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL
    if (!apiUrl) return

    timerRef.current = setTimeout(() => setShow(true), 4000)

    fetch(`${apiUrl}/api/health`)
      .finally(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        setShow(false)
      })

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  if (!show) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-50 border-b border-amber-200 text-center text-xs text-amber-700 py-1.5">
      Connecting to server…
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState<AppMode>(() =>
    (localStorage.getItem('app_mode') as AppMode) ?? 'consumer'
  )

  function handleSetMode(m: AppMode) {
    setMode(m)
    localStorage.setItem('app_mode', m)
  }

  return (
    <CardProvider>
      <BrowserRouter>
        <ServerWakeBanner />
        <AppLayout mode={mode} setMode={handleSetMode} />
        <Toaster position="top-center" />
      </BrowserRouter>
    </CardProvider>
  )
}
