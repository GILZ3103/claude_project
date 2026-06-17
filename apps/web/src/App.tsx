import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { motion, AnimatePresence } from 'motion/react'
import { CardProvider, useCard } from './context/CardContext'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Calories from './pages/Calories'
import Campaigns from './pages/Campaigns'
import Vendors from './pages/Vendors'
import Catalogue from './pages/Catalogue'
import Map from './pages/Map'
import NfcConnect from './pages/NfcConnect'
import Settings from './pages/Settings'
import VendorDashboard from './pages/VendorDashboard'
import VendorInformation from './pages/VendorInformation'
import VendorClaim from './pages/VendorClaim'
import VendorSummary from './pages/VendorSummary'
import AdminDashboard from './pages/AdminDashboard'
import Vouchers from './pages/Vouchers'
import AiChat from './components/AiChat'
import { TopNav } from './components/TopNav'
import MiniGame from './pages/MiniGame'
import GamesHub from './pages/GamesHub'
import FlappyGame from './pages/FlappyGame'
import StackGame from './pages/StackGame'

type AppMode = 'consumer' | 'vendor'

function AppLayout({ mode, setMode }: { mode: AppMode; setMode: (m: AppMode) => void }) {
  const location = useLocation()
  const { card } = useCard()
  const onAuthPage = location.pathname === '/'
  const showTopNav = !onAuthPage && !!card
  const showAiChat = showTopNav && card?.role !== 'ADMIN'

  return (
    <div className={`min-h-screen bg-gray-50 ${showTopNav ? 'pt-14 pb-16 md:pb-0' : ''}`}>
      {showTopNav && <TopNav mode={mode} setMode={setMode} />}
      {showAiChat && <AiChat />}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        >
          <Routes location={location}>
            <Route path="/" element={<Auth />} />
            {/* Consumer routes */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/calories" element={<Calories />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/catalogue" element={<Catalogue />} />
            <Route path="/map" element={<Map />} />
            <Route path="/nfc" element={<NfcConnect />} />
            <Route path="/vouchers" element={<Vouchers />} />
            <Route path="/games" element={<GamesHub />} />
            <Route path="/games/spin" element={<MiniGame />} />
            <Route path="/games/flappy" element={<FlappyGame />} />
            <Route path="/games/stack" element={<StackGame />} />
            <Route path="/game" element={<Navigate to="/games" replace />} />
            <Route path="/settings" element={<Settings />} />
            {/* Vendor routes */}
            <Route path="/vendor/dashboard" element={<VendorDashboard />} />
            <Route path="/vendor/information" element={<VendorInformation />} />
            <Route path="/vendor/campaigns" element={<Campaigns />} />
            <Route path="/vendor/claim" element={<VendorClaim />} />
            <Route path="/vendor/summary" element={<VendorSummary />} />
            {/* Admin route */}
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </motion.div>
      </AnimatePresence>

      {/* Brand-colored veil that flashes over the screen on every navigation,
          then slowly fades away to reveal the new page underneath. */}
      <AnimatePresence>
        <motion.div
          key={`veil-${location.pathname}`}
          initial={{ opacity: 0.92 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="fixed inset-0 z-[200] pointer-events-none bg-gradient-to-br from-[#FF8A00] to-[#FFD166]"
        />
      </AnimatePresence>
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
