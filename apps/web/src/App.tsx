import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { CardProvider } from './context/CardContext'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Campaigns from './pages/Campaigns'
import Vendors from './pages/Vendors'
import Map from './pages/Map'

// Hide bottom nav on auth pages
const NO_NAV = ['/', '/register']

function Nav() {
  const { pathname } = useLocation()
  if (NO_NAV.includes(pathname)) return null

  const base = 'text-xs font-medium px-3 py-2 rounded-lg transition-colors'
  const active = `${base} bg-black text-white`
  const inactive = `${base} text-gray-500`

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-2 z-10">
      <NavLink to="/dashboard" className={({ isActive }) => isActive ? active : inactive}>Dashboard</NavLink>
      <NavLink to="/campaigns" className={({ isActive }) => isActive ? active : inactive}>Campaigns</NavLink>
      <NavLink to="/vendors" className={({ isActive }) => isActive ? active : inactive}>Vendors</NavLink>
      <NavLink to="/map" className={({ isActive }) => isActive ? active : inactive}>Map</NavLink>
    </nav>
  )
}

export default function App() {
  return (
    <CardProvider>
      <BrowserRouter>
        <div className="pb-16 min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/map" element={<Map />} />
          </Routes>
          <Nav />
        </div>
        <Toaster position="top-center" />
      </BrowserRouter>
    </CardProvider>
  )
}
