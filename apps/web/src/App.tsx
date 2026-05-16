import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
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
import AiChat from './components/AiChat'

const NO_NAV = ['/', '/admin']

type AppMode = 'consumer' | 'vendor'

function ModeToggle({ mode, setMode }: { mode: AppMode; setMode: (m: AppMode) => void }) {
  const { card } = useCard()
  if (card?.role !== 'VENDOR') return null

  return (
    <div className="fixed top-0 left-0 right-0 z-20 bg-white border-b border-gray-100 px-4 py-2 flex justify-center">
      <div className="bg-gray-200 rounded-full p-0.5 flex relative w-48">
        <div
          className="absolute top-0.5 bottom-0.5 w-1/2 bg-black rounded-full transition-all duration-300"
          style={{ left: mode === 'consumer' ? '2px' : 'calc(50% - 2px)' }}
        />
        <button
          onClick={() => setMode('consumer')}
          className={`flex-1 z-10 py-1.5 text-xs font-semibold rounded-full transition-colors ${mode === 'consumer' ? 'text-white' : 'text-gray-500'}`}
        >
          Consumer
        </button>
        <button
          onClick={() => setMode('vendor')}
          className={`flex-1 z-10 py-1.5 text-xs font-semibold rounded-full transition-colors ${mode === 'vendor' ? 'text-white' : 'text-gray-500'}`}
        >
          Vendor
        </button>
      </div>
    </div>
  )
}

function ConsumerNav() {
  const base = 'text-xs font-medium px-2 py-2 rounded-lg transition-colors'
  const active = `${base} bg-black text-white`
  const inactive = `${base} text-gray-500`
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-2 z-10">
      <NavLink to="/dashboard" className={({ isActive }) => isActive ? active : inactive}>Home</NavLink>
      <NavLink to="/calories" className={({ isActive }) => isActive ? active : inactive}>Calories</NavLink>
      <NavLink to="/campaigns" className={({ isActive }) => isActive ? active : inactive}>Campaigns</NavLink>
      <NavLink to="/vendors" className={({ isActive }) => isActive ? active : inactive}>Vendors</NavLink>
      <NavLink to="/nfc" className={({ isActive }) => isActive ? active : inactive}>NFC</NavLink>
      <NavLink to="/settings" className={({ isActive }) => isActive ? active : inactive}>Settings</NavLink>
    </nav>
  )
}

function VendorNav() {
  const base = 'text-xs font-medium px-2 py-2 rounded-lg transition-colors'
  const active = `${base} bg-black text-white`
  const inactive = `${base} text-gray-500`
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-2 z-10">
      <NavLink to="/vendor/dashboard" className={({ isActive }) => isActive ? active : inactive}>Home</NavLink>
      <NavLink to="/vendor/information" className={({ isActive }) => isActive ? active : inactive}>Info</NavLink>
      <NavLink to="/vendor/campaigns" className={({ isActive }) => isActive ? active : inactive}>Campaigns</NavLink>
      <NavLink to="/vendor/claim" className={({ isActive }) => isActive ? active : inactive}>Claim</NavLink>
      <NavLink to="/settings" className={({ isActive }) => isActive ? active : inactive}>Settings</NavLink>
    </nav>
  )
}

function AppLayout({ mode, setMode }: { mode: AppMode; setMode: (m: AppMode) => void }) {
  const { pathname } = useLocation()
  const { card } = useCard()
  const isAdmin = card?.role === 'ADMIN'
  const showNav = !NO_NAV.includes(pathname) && !isAdmin
  const showToggle = showNav && card?.role === 'VENDOR'
  const topPad = showToggle ? 'pt-12' : ''

  return (
    <div className={`pb-16 min-h-screen bg-gray-50 ${topPad}`}>
      {showToggle && <ModeToggle mode={mode} setMode={setMode} />}
      {showNav && <AiChat />}
      <Routes>
        <Route path="/" element={<Auth />} />
        {/* Consumer routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/calories" element={<Calories />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/map" element={<Map />} />
        <Route path="/nfc" element={<NfcConnect />} />
        <Route path="/settings" element={<Settings />} />
        {/* Vendor routes */}
        <Route path="/vendor/dashboard" element={<VendorDashboard />} />
        <Route path="/vendor/information" element={<VendorInformation />} />
        <Route path="/vendor/campaigns" element={<Campaigns />} />
        <Route path="/vendor/claim" element={<VendorClaim />} />
        <Route path="/vendor/summary" element={<VendorSummary />} />
        {/* Admin route — full dashboard built in Phase 3 */}
        <Route path="/admin" element={<AdminPlaceholder />} />
      </Routes>
      {showNav && (mode === 'vendor' && card?.role === 'VENDOR' ? <VendorNav /> : <ConsumerNav />)}
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
