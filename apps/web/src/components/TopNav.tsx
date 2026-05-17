import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Zap, Bell, Globe, User, Store, Shield, Settings, Home, Flame, Map, Gift } from 'lucide-react'
import { useCard } from '../context/CardContext'

type AppMode = 'consumer' | 'vendor'

interface TopNavProps {
  mode: AppMode
  setMode: (m: AppMode) => void
}

export function TopNav({ mode, setMode }: TopNavProps) {
  const { card } = useCard()
  const navigate = useNavigate()
  const [showLang, setShowLang] = useState(false)
  const [showNotif, setShowNotif] = useState(false)

  if (!card) return null

  const isVendor = card.role === 'VENDOR'
  const isAdmin = card.role === 'ADMIN'

  const consumerLinks = [
    { href: '/dashboard', label: 'Home', icon: <Home size={13} /> },
    { href: '/calories', label: 'Calories', icon: <Flame size={13} /> },
    { href: '/vouchers', label: 'Vouchers', icon: <Gift size={13} /> },
    { href: '/map', label: 'Map', icon: <Map size={13} /> },
    { href: '/settings', label: 'Settings', icon: <Settings size={13} /> },
  ]

  const vendorLinks = [
    { href: '/vendor/dashboard', label: 'Dashboard', icon: <Store size={13} /> },
    { href: '/vendor/information', label: 'Menu', icon: <Store size={13} /> },
    { href: '/vendor/claim', label: 'Compliance', icon: <Shield size={13} /> },
    { href: '/settings', label: 'Settings', icon: <Settings size={13} /> },
  ]

  const adminLinks = [
    { href: '/admin', label: 'Admin Console', icon: <Shield size={13} /> },
    { href: '/settings', label: 'Settings', icon: <Settings size={13} /> },
  ]

  const links = isAdmin ? adminLinks : (isVendor && mode === 'vendor') ? vendorLinks : consumerLinks

  function handleVendorModeSwitch(newMode: AppMode) {
    setMode(newMode)
    if (newMode === 'vendor') navigate('/vendor/dashboard')
    else navigate('/dashboard')
  }

  // Pill position for vendor toggle
  const pillLeft = mode === 'consumer' ? '2px' : 'calc(50% - 2px)'

  return (
    <nav className="fixed top-0 left-0 w-full z-50 backdrop-blur-xl bg-white/80 border-b border-white/50 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-sm">
      {/* Logo */}
      <div
        className="flex items-center space-x-2 cursor-pointer"
        onClick={() => navigate(isAdmin ? '/admin' : mode === 'vendor' ? '/vendor/dashboard' : '/dashboard')}
      >
        <Zap size={20} className="text-[#FF8A00] fill-[#FF8A00]" />
        <span className="font-bold text-[#1A1A1A] tracking-tight hidden sm:inline">WarungTek</span>
      </div>

      {/* Desktop nav links */}
      <div className="hidden md:flex items-center space-x-5 mx-4">
        {links.map(link => (
          <NavLink
            key={link.href}
            to={link.href}
            className={({ isActive }) =>
              `flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${isActive ? 'text-[#FF8A00]' : 'text-gray-600 hover:text-[#FF8A00]'}`
            }
          >
            {link.icon}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </div>

      <div className="flex items-center space-x-2">
        {/* Language placeholder */}
        <div className="relative">
          <button
            onClick={() => setShowLang(v => !v)}
            className="flex items-center gap-1 p-2 text-gray-500 hover:text-[#FF8A00] rounded-xl hover:bg-orange-50 transition-colors"
          >
            <Globe size={16} />
            <span className="text-[10px] font-bold uppercase hidden sm:inline">EN</span>
          </button>
          <AnimatePresence>
            {showLang && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLang(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
                >
                  {[{ code: 'EN', label: 'English' }, { code: 'MS', label: 'Bahasa Melayu' }, { code: 'ZH', label: '中文' }].map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => setShowLang(false)}
                      className={`w-full px-4 py-3 text-left text-sm font-semibold transition-colors ${lang.code === 'EN' ? 'bg-orange-50 text-[#FF8A00]' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      {lang.label}
                      {lang.code !== 'EN' && <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Soon</span>}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotif(v => !v)}
            className="relative p-2 text-gray-500 hover:text-[#FF8A00] rounded-xl hover:bg-orange-50 transition-colors"
          >
            <Bell size={18} />
          </button>
          <AnimatePresence>
            {showNotif && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-gray-100 bg-[#FAFAFA] flex justify-between items-center">
                    <h4 className="font-semibold text-sm text-[#1A1A1A]">Notifications</h4>
                  </div>
                  <div className="p-6 text-center text-sm text-[#6B7280]">
                    <Bell size={24} className="mx-auto mb-2 text-gray-300" />
                    No notifications yet
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Vendor mode toggle — only for VENDOR role */}
        {isVendor && (
          <div className="relative flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 w-36 mx-1">
            <div
              className="absolute inset-y-1 w-[calc(50%-3px)] bg-white rounded-lg shadow-sm transition-all duration-300"
              style={{ left: pillLeft }}
            />
            <button
              onClick={() => handleVendorModeSwitch('consumer')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${mode === 'consumer' ? 'text-[#FF8A00]' : 'text-gray-500'}`}
            >
              <User size={12} />
              <span>Consumer</span>
            </button>
            <button
              onClick={() => handleVendorModeSwitch('vendor')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${mode === 'vendor' ? 'text-[#FF8A00]' : 'text-gray-500'}`}
            >
              <Store size={12} />
              <span>Vendor</span>
            </button>
          </div>
        )}

        {/* User avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => navigate('/settings')}
            className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF8A00] to-[#FFD166] flex items-center justify-center text-white font-bold text-sm shadow-sm hover:shadow-md transition-shadow"
            title={card.owner_name}
          >
            {(card.owner_name ?? 'U')[0].toUpperCase()}
          </button>
        </div>
      </div>
    </nav>
  )
}
