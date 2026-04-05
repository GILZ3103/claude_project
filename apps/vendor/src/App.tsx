import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { VendorProvider, useVendor } from './context/VendorContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Information from './pages/Information'
import Summary from './pages/Summary'
import Claim from './pages/Claim'
import VendorCampaigns from './pages/VendorCampaigns'
import Settings from './pages/Settings'

function Nav() {
  const base = 'text-xs font-medium px-2 py-2 rounded-lg transition-colors'
  const active = `${base} bg-black text-white`
  const inactive = `${base} text-gray-500`

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-2 z-10">
      <NavLink to="/home" className={({ isActive }) => isActive ? active : inactive}>Home</NavLink>
      <NavLink to="/information" className={({ isActive }) => isActive ? active : inactive}>Info</NavLink>
      <NavLink to="/campaigns" className={({ isActive }) => isActive ? active : inactive}>Campaigns</NavLink>
      <NavLink to="/claim" className={({ isActive }) => isActive ? active : inactive}>Claim</NavLink>
      <NavLink to="/settings" className={({ isActive }) => isActive ? active : inactive}>Settings</NavLink>
    </nav>
  )
}

function AppRouter() {
  const { card, vendorId, loading } = useVendor()
  const { pathname } = useLocation()

  // Auth pages — always accessible
  if (pathname === '/register') return <Register />

  // Loading session restore
  if (loading) return null

  // Not logged in → Login
  if (!card) return <Login />

  // Logged in but no stall registered yet → Onboarding
  if (!vendorId && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />

  // Onboarding page
  if (pathname === '/onboarding') return <Onboarding />

  // Fully authed — main app
  return (
    <div className="pb-16 min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/information" element={<Information />} />
        <Route path="/campaigns" element={<VendorCampaigns />} />
        <Route path="/summary" element={<Summary />} />
        <Route path="/claim" element={<Claim />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <Nav />
    </div>
  )
}

export default function App() {
  return (
    <VendorProvider>
      <BrowserRouter>
        <AppRouter />
        <Toaster position="top-center" />
      </BrowserRouter>
    </VendorProvider>
  )
}
