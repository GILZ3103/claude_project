import { useState, useMemo, useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Stall } from './app/data'
import { VOUCHERS } from './app/data'
import { Header } from './app/components/Header'
import { Intro } from './app/components/Intro'
import type { FilterState } from './app/components/FilterPanel'
import { FilterPanel } from './app/components/FilterPanel'
import { StallGrid } from './app/components/StallGrid'
import { StallDetails } from './app/components/StallDetails'
import { SmartNav } from './app/components/SmartNav'
import { WalletPanel } from './app/components/WalletPanel'
import { HelpDrawer, EmergencyModal } from './app/components/HelpAndEmergency'
import { SettingsModal } from './app/components/SettingsModal'
import { UserBar } from './app/components/UserBar'
import { FaceRecognizedModal } from './app/components/FaceRecognizedModal'
import { fetchStalls } from './lib/transforms'
import toast, { Toaster } from 'react-hot-toast'

const NFC_URL = import.meta.env.VITE_NFC_DAEMON_URL ?? 'http://localhost:5001'
const FACE_URL = import.meta.env.VITE_FACE_DAEMON_URL ?? 'http://localhost:5002'
const BASE_API = import.meta.env.VITE_API_URL
const KIOSK_ID = import.meta.env.VITE_KIOSK_ID ?? 'kiosk-01'
const POLL_MS = 1500

export default function App() {
  const [language, setLanguage] = useState<'en' | 'ms' | 'zh'>('en')
  const [searchQuery, setSearchQuery] = useState('')
  const [stalls, setStalls] = useState<Stall[]>([])
  const [loadingStalls, setLoadingStalls] = useState(true)

  // User / NFC state
  const [isUserMode, setIsUserMode] = useState(false)
  const [showLoginAnim, setShowLoginAnim] = useState(false)
  const [cardData, setCardData] = useState<any>(null)
  const lastUid = useRef<string | null>(null)

  // Face recognition state
  const [showFaceModal, setShowFaceModal] = useState(false)
  const lastFaceUid = useRef<string | null>(null)

  // Wallet state (populated from real card on NFC tap)
  const [balance, setBalance] = useState(0)
  const [points, setPoints] = useState(0)
  const [vouchers, setVouchers] = useState<any[]>(VOUCHERS)
  const [activeCampaigns, setActiveCampaigns] = useState(0)

  // Settings
  const [calorieTarget, setCalorieTarget] = useState(2000)
  const [preferences, setPreferences] = useState({
    vegetarian: false, halal: true, lowSugar: false, seafoodFree: false,
  })

  const [filters, setFilters] = useState<FilterState>({
    category: null, calories: null, dietary: [], vendorType: [],
    distance: [], voucher: null, availability: [],
  })

  type Overlay = 'stall' | 'nav' | 'nfc' | 'vouchers' | 'help' | 'emergency' | 'settings' | null
  const [activeOverlay, setActiveOverlay] = useState<Overlay>(null)
  const [activeStall, setActiveStall] = useState<Stall | null>(null)
  const [navDestination, setNavDestination] = useState<Stall | null>(null)

  // ── Load stalls from backend ───────────────────────────────────────────────

  useEffect(() => {
    fetchStalls().then(data => {
      setStalls(data)
      setLoadingStalls(false)
    })
  }, [])

  // ── NFC polling ───────────────────────────────────────────────────────────

  useEffect(() => {
    let active = true

    async function poll() {
      if (!active) return
      try {
        const res = await fetch(`${NFC_URL}/nfc`)
        const data = await res.json()
        if (data.uid && data.uid !== lastUid.current) {
          lastUid.current = data.uid
          handleNfcTap(data.uid)
          setTimeout(() => { lastUid.current = null }, 4000)
        }
      } catch {
        // daemon offline — silent retry
      }
      if (active) setTimeout(poll, POLL_MS)
    }

    poll()
    return () => { active = false }
  }, [])

  // ── Face recognition polling ──────────────────────────────────────────────

  useEffect(() => {
    let active = true

    async function pollFace() {
      if (!active || isUserMode) return
      try {
        const res = await fetch(`${FACE_URL}/face/recognized`)
        if (res.status === 200) {
          const data = await res.json()
          if (data.uid && data.uid !== lastFaceUid.current) {
            lastFaceUid.current = data.uid
            const success = await handleFaceTap(data.uid)
            if (!success) lastFaceUid.current = null  // allow retry on next poll
          }
        }
      } catch {
        // face daemon offline — silent retry
      }
      if (active) setTimeout(pollFace, 1000)
    }

    pollFace()
    return () => { active = false }
  }, [isUserMode])

  async function loadCardData(_uid: string, encodedUid: string) {
    const cardRes = await fetch(`${BASE_API}/api/cards/${encodedUid}`, { signal: AbortSignal.timeout(8000) })
    const cardJson = await cardRes.json()
    if (!cardJson.success) return null

    const card = cardJson.data
    setCardData(card)
    setBalance(Number(card.points_balance))
    setPoints(Number(card.points_balance))
    setCalorieTarget(card.calorie_limit ?? 2000)

    // Fetch vouchers
    try {
      const voucherRes = await fetch(`${BASE_API}/api/cards/${encodedUid}/vouchers?status=ACTIVE`)
      const voucherJson = await voucherRes.json()
      if (voucherJson.success && voucherJson.data?.length > 0) {
        setVouchers(voucherJson.data.map((v: any) => ({
          id: v.voucher_id,
          title: v.discount_value ? `RM${v.discount_value} OFF` : 'Reward Voucher',
          stall: 'Any Stall',
          expiry: v.expires_at ? new Date(v.expires_at).toLocaleDateString() : 'No expiry',
          status: 'Active' as const,
          code: v.voucher_id.slice(0, 8).toUpperCase(),
          terms: 'Valid at participating stalls',
          image: undefined as string | undefined,
        })))
      }
    } catch { /* non-critical */ }

    // Fetch active campaigns count
    try {
      const campRes = await fetch(`${BASE_API}/api/campaigns?uid=${encodedUid}&status=ACTIVE`)
      const campJson = await campRes.json()
      setActiveCampaigns(campJson.success ? (campJson.data?.length ?? 0) : 0)
    } catch { /* non-critical */ }

    return card
  }

  async function handleFaceTap(uid: string): Promise<boolean> {
    try {
      const encodedUid = encodeURIComponent(uid)
      const card = await loadCardData(uid, encodedUid)
      if (!card) return false
      setIsUserMode(true)
      setShowFaceModal(true)
      return true
    } catch {
      return false
    }
  }

  async function handleNfcTap(uid: string) {
    setShowLoginAnim(true)
    const encodedUid = encodeURIComponent(uid)

    try {
      const card = await loadCardData(uid, encodedUid)

      if (card) {
        // Log directory rebate
        try {
          await fetch(`${BASE_API}/api/kiosk/tap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card_uid: uid, kiosk_id: KIOSK_ID, device_timestamp: new Date().toISOString() }),
          })
          toast.success(`Welcome, ${card.owner_name}! +5 pts`)
        } catch { /* non-critical */ }

        setTimeout(() => {
          setIsUserMode(true)
          setShowLoginAnim(false)
          setShowFaceModal(false)  // close face modal if open
          setActiveOverlay('nfc')
        }, 1500)
      } else {
        toast.error('Card not registered')
        setTimeout(() => setShowLoginAnim(false), 1500)
      }
    } catch (e: any) {
      console.error('Card lookup failed:', e)
      toast.error(`Server: ${e?.message ?? 'unreachable'}`)
      setTimeout(() => setShowLoginAnim(false), 1500)
    }
  }

  function handleLogout() {
    setIsUserMode(false)
    setCardData(null)
    setBalance(0)
    setPoints(0)
    setActiveCampaigns(0)
    setShowFaceModal(false)
    lastUid.current = null
    lastFaceUid.current = null
  }

  // ── Filtered stalls ────────────────────────────────────────────────────────

  const filteredStalls = useMemo(() => {
    return stalls.filter(stall => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match = stall.name.toLowerCase().includes(q) ||
          stall.featuredFood.toLowerCase().includes(q) ||
          stall.category.toLowerCase().includes(q)
        if (!match) return false
      }
      if (preferences.halal && !stall.isHalal) return false
      if (preferences.vegetarian && !stall.isVegetarian) return false
      if (filters.category && stall.category !== filters.category) return false
      if (filters.calories) {
        const cal = parseInt(stall.calories)
        if (filters.calories === 'Under 300 kcal' && cal > 300) return false
        if (filters.calories === 'Under 500 kcal' && cal > 500) return false
      }
      if (filters.dietary.length > 0) {
        if (filters.dietary.includes('Vegetarian') && !stall.isVegetarian) return false
        if (filters.dietary.includes('Low Sugar') && !stall.isLowSugar) return false
      }
      if (filters.vendorType.length > 0) {
        if (filters.vendorType.includes('Halal') && !stall.isHalal) return false
        if (filters.vendorType.includes('Vegetarian') && !stall.isVegetarian) return false
      }
      if (filters.voucher === 'Voucher Available' && !stall.hasVoucher) return false
      return true
    })
  }, [stalls, searchQuery, filters, preferences])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleLogoClick = () => {
    setSearchQuery('')
    setFilters({ category: null, calories: null, dietary: [], vendorType: [], distance: [], voucher: null, availability: [] })
    setActiveOverlay(null)
  }

  const handleIconClick = (action: string) => {
    if (action === 'language') {
      setLanguage(prev => prev === 'en' ? 'ms' : prev === 'ms' ? 'zh' : 'en')
    } else {
      setActiveOverlay(action as Overlay)
    }
  }

  const handleStallClick = (stall: Stall) => {
    setActiveStall(stall)
    setActiveOverlay('stall')
  }

  const handleNavigate = () => {
    setNavDestination(activeStall)
    setActiveOverlay('nav')
  }

  return (
    <div className="w-full h-screen bg-[#F7F7F5] overflow-hidden flex flex-col relative font-sans">
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onLogoClick={handleLogoClick}
        onIconClick={handleIconClick}
        language={language}
      />

      {/* User mode top bar — replaces floating badge */}
      {isUserMode && cardData && (
        <UserBar
          ownerName={cardData.owner_name}
          points={points}
          caloriesRemaining={calorieTarget - (cardData.calories_today ?? 0)}
          activeCampaigns={activeCampaigns}
          onLogout={handleLogout}
          language={language}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Intro
          activeCategory={filters.category as any}
          onCategoryClick={(cat) => setFilters(prev => ({ ...prev, category: prev.category === cat ? null : cat }))}
          language={language}
        />

        <div className="flex-1 flex overflow-hidden">
          <FilterPanel
            filters={filters}
            setFilters={setFilters}
            language={language}
            isUserMode={isUserMode}
          />
          <div className="flex-1 flex flex-col h-full relative">
            <StallGrid
              stalls={filteredStalls}
              filters={filters}
              setFilters={setFilters}
              onStallClick={handleStallClick}
              language={language}
            />

            {loadingStalls && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                <p className="text-gray-500 animate-pulse">Loading stalls...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Emergency Button */}
      <button
        onClick={() => setActiveOverlay('emergency')}
        className="absolute bottom-6 left-6 w-14 h-14 bg-red-600 rounded-full shadow-lg flex items-center justify-center text-white hover:bg-red-700 transition-colors z-30"
      >
        <AlertTriangle className="w-6 h-6" />
      </button>

      {/* Backdrop */}
      {activeOverlay && activeOverlay !== 'nav' && activeOverlay !== 'emergency' && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity" onClick={() => setActiveOverlay(null)} />
      )}

      {/* Face Recognized Modal */}
      {showFaceModal && cardData && (
        <FaceRecognizedModal
          ownerName={cardData.owner_name}
          hasPhysicalCard={cardData.has_physical_card ?? false}
          onDismiss={() => setShowFaceModal(false)}
          language={language}
        />
      )}

      {/* NFC Login Animation */}
      {showLoginAnim && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 bg-white/20 rounded-full animate-ping flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.8)]">
                <span className="text-3xl">💳</span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-widest uppercase">NFC Detected</h2>
            {cardData && <p className="text-white/70 mt-2">Welcome, {cardData.owner_name}</p>}
          </div>
        </div>
      )}

      {/* Overlays */}
      {activeOverlay === 'stall' && activeStall && (
        <StallDetails stall={activeStall} onClose={() => setActiveOverlay(null)} onNavigate={handleNavigate} language={language} />
      )}

      {(activeOverlay === 'nfc' || activeOverlay === 'vouchers') && (
        <WalletPanel
          onClose={() => setActiveOverlay(null)}
          language={language}
          initialTab={activeOverlay === 'vouchers' ? 'vouchers' : 'balance'}
          isUserMode={isUserMode}
          balance={balance}
          setBalance={setBalance}
          points={points}
          setPoints={setPoints}
          vouchers={vouchers}
          setVouchers={setVouchers}
          onNavigateToStall={(stallName) => {
            const stall = stalls.find(s => s.name === stallName)
            if (stall) { setNavDestination(stall); setActiveOverlay('nav') }
          }}
        />
      )}

      {activeOverlay === 'settings' && (
        <SettingsModal
          onClose={() => setActiveOverlay(null)}
          language={language}
          isUserMode={isUserMode}
          onLogout={handleLogout}
          globalPreferences={preferences}
          setGlobalPreferences={setPreferences}
          globalCalorieTarget={calorieTarget}
          setGlobalCalorieTarget={setCalorieTarget}
        />
      )}

      {activeOverlay === 'help' && (
        <HelpDrawer onClose={() => setActiveOverlay(null)} language={language} />
      )}

      {activeOverlay === 'nav' && (
        <SmartNav destination={navDestination} onClose={() => setActiveOverlay(null)} language={language} />
      )}

      {activeOverlay === 'emergency' && (
        <EmergencyModal onClose={() => setActiveOverlay(null)} language={language} />
      )}

      <Toaster position="top-center" />
    </div>
  )
}
