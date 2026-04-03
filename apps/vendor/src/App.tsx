import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { VendorProvider, useVendor } from './context/VendorContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import Menu from './pages/Menu'
import Summary from './pages/Summary'
import Claim from './pages/Claim'
import VendorCampaigns from './pages/VendorCampaigns'

function Nav() {
  const base = 'text-xs font-medium px-3 py-2 rounded-lg transition-colors'
  const active = `${base} bg-black text-white`
  const inactive = `${base} text-gray-500`

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-2 z-10">
      <NavLink to="/menu" className={({ isActive }) => isActive ? active : inactive}>Menu</NavLink>
      <NavLink to="/campaigns" className={({ isActive }) => isActive ? active : inactive}>Campaigns</NavLink>
      <NavLink to="/summary" className={({ isActive }) => isActive ? active : inactive}>Summary</NavLink>
      <NavLink to="/claim" className={({ isActive }) => isActive ? active : inactive}>Claim</NavLink>
    </nav>
  )
}

function AppRouter() {
  const { card, vendorId, logout, loading } = useVendor()
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
      <div className="flex justify-between items-center px-6 pt-4 pb-2 border-b border-gray-100 bg-white">
        <p className="text-sm font-medium">{card.owner_name}</p>
        <button onClick={logout} className="text-xs text-gray-400 underline">Logout</button>
      </div>
      <Routes>
        <Route path="/" element={<Navigate to="/menu" replace />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/campaigns" element={<VendorCampaigns />} />
        <Route path="/summary" element={<Summary />} />
        <Route path="/claim" element={<Claim />} />
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
