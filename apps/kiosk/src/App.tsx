import { useState, useMemo, useEffect, useRef } from 'react'
import { AlertTriangle, Wifi } from 'lucide-react'
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
import { NfcCardOfferModal } from './app/components/NfcCardOfferModal'
import { LoginAnimation } from './app/components/LoginAnimation'
import { BottomNav } from './app/components/BottomNav'
import { OnScreenKeyboard } from './app/components/OnScreenKeyboard'
import { fetchStalls } from './lib/transforms'
import toast, { Toaster } from 'react-hot-toast'

const NFC_URL = import.meta.env.VITE_NFC_DAEMON_URL ?? 'http://localhost:5001'
const FACE_URL = import.meta.env.VITE_FACE_DAEMON_URL ?? 'http://localhost:5002'
const BASE_API = import.meta.env.VITE_API_URL
const KIOSK_ID = import.meta.env.VITE_KIOSK_ID ?? 'kiosk-01'
const POLL_MS = 1500
const FACE_RELOGIN_COOLDOWN_MS = 20000   // after logout, ignore the SAME face for 20s so logout sticks

export default function App() {
  const [language, setLanguage] = useState<'en' | 'ms' | 'zh'>('en')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [stalls, setStalls] = useState<Stall[]>([])
  const [loadingStalls, setLoadingStalls] = useState(true)

  // User / NFC state
  const [isUserMode, setIsUserMode] = useState(false)
  const [showLoginAnim, setShowLoginAnim] = useState(false)
  const [cardData, setCardData] = useState<any>(null)
  const lastUid = useRef<string | null>(null)

  // Card linking state (activated at kiosk after face login)
  const [cardLinkStatus, setCardLinkStatus] = useState<'idle' | 'linking' | 'done' | 'error'>('idle')
  const cardLinkStatusRef = useRef<'idle' | 'linking' | 'done' | 'error'>('idle')
  const cardDataRef = useRef<any>(null)

  // NFC confirmation for topup / calorie update / campaign enrol
  type PendingNfcAction =
    | { type: 'topup'; amount: number; method: string }
    | { type: 'calorie'; limit: number }
    | { type: 'campaign'; campaign_id: string; name: string }
  const [pendingAction, setPendingAction] = useState<PendingNfcAction | null>(null)
  const pendingActionRef = useRef<PendingNfcAction | null>(null)

  // Face recognition state
  const [loginSource, setLoginSource] = useState<'nfc' | 'face' | null>(null)
  const lastFaceUid = useRef<string | null>(null)
  const logoutInfo = useRef<{ uid: string | null; at: number }>({ uid: null, at: 0 })
  const [faceConfidence, setFaceConfidence] = useState(0)
  const [faceDaemonOnline, setFaceDaemonOnline] = useState(false)
  const [faceAnimLoading, setFaceAnimLoading] = useState(false)

  // Wallet state (populated from real card on NFC tap)
  const [balance, setBalance] = useState(0)
  const [points, setPoints] = useState(0)
  const [vouchers, setVouchers] = useState<any[]>(VOUCHERS)
  const [activeCampaigns, setActiveCampaigns] = useState(0)
  const [campaigns, setCampaigns] = useState<any[]>([])

  // Settings
  const [calorieTarget, setCalorieTarget] = useState(2000)
  const [preferences, setPreferences] = useState({
    vegetarian: false, halal: true, lowSugar: false, seafoodFree: false,
  })

  const [filters, setFilters] = useState<FilterState>({
    category: null, calories: null, dietary: [], vendorType: [],
    distance: [], voucher: null, availability: [],
  })

  // Favourite stalls — persisted locally so the heart toggle survives reloads.
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('wt_favorites')
      return new Set<string>(raw ? JSON.parse(raw) : [])
    } catch { return new Set<string>() }
  })
  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem('wt_favorites', JSON.stringify([...next])) } catch { /* storage unavailable */ }
      return next
    })
  }

  type Overlay = 'stall' | 'nav' | 'nfc' | 'vouchers' | 'help' | 'emergency' | 'settings' | 'card-offer' | 'menu' | null
  const [activeOverlay, setActiveOverlay] = useState<Overlay>(null)
  const [activeStall, setActiveStall] = useState<Stall | null>(null)
  const [navDestination, setNavDestination] = useState<Stall | null>(null)

  // Keep refs in sync so poll closures always see current values
  useEffect(() => { cardLinkStatusRef.current = cardLinkStatus }, [cardLinkStatus])
  useEffect(() => { cardDataRef.current = cardData }, [cardData])
  useEffect(() => { pendingActionRef.current = pendingAction }, [pendingAction])

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
          if (cardLinkStatusRef.current === 'linking') {
            handleNfcLink(data.uid)
          } else if (pendingActionRef.current) {
            handleNfcConfirm()
          } else {
            handleNfcTap(data.uid)
          }
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
        setFaceDaemonOnline(true)
        if (res.status === 200) {
          const data = await res.json()
          if (data.uid && data.uid !== lastFaceUid.current) {
            const lo = logoutInfo.current
            const sameUserCoolingDown = data.uid === lo.uid && (Date.now() - lo.at) < FACE_RELOGIN_COOLDOWN_MS
            if (!sameUserCoolingDown) {
              lastFaceUid.current = data.uid
              const success = await handleFaceTap(data.uid, data.confidence ?? 0, data.owner_name ?? '')
              if (!success) setTimeout(() => { lastFaceUid.current = null }, 15000)
            }
          }
        }
      } catch {
        setFaceDaemonOnline(false)
      }
      if (active) setTimeout(pollFace, 1000)
    }

    pollFace()
    return () => { active = false }
  }, [isUserMode])


  async function loadCardData(_uid: string, encodedUid: string) {
    const cardRes = await fetch(`${BASE_API}/api/cards/${encodedUid}`, { signal: AbortSignal.timeout(30000) })
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

    // Fetch campaigns (full list for Loyalty tab + count for UserBar)
    try {
      const campRes = await fetch(`${BASE_API}/api/campaigns?card_uid=${encodedUid}&status=ACTIVE`)
      const campJson = await campRes.json()
      const campData = campJson.success ? (campJson.data ?? []) : []
      setCampaigns(campData)
      setActiveCampaigns(campData.length)
    } catch { /* non-critical */ }

    return card
  }

  async function handleFaceTap(uid: string, confidence: number, ownerName: string): Promise<boolean> {
    setLoginSource('face')
    setFaceConfidence(confidence)
    setFaceAnimLoading(true)
    setCardData({ owner_name: ownerName, has_physical_card: false, points_balance: 0, calorie_limit: calorieTarget } as any)
    setShowLoginAnim(true)

    try {
      const encodedUid = encodeURIComponent(uid)
      const card = await loadCardData(uid, encodedUid)
      setFaceAnimLoading(false)

      if (!card) {
        setTimeout(() => {
          setShowLoginAnim(false)
          setLoginSource(null)
          setCardData(null)
          toast.error('Face not linked to a registered card')
        }, 1500)
        return false
      }

      fetch(`${BASE_API}/api/face/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_uid: uid, kiosk_id: KIOSK_ID, confidence, device_timestamp: new Date().toISOString() }),
      }).catch(() => {})

      setTimeout(() => {
        setIsUserMode(true)
        setShowLoginAnim(false)
        setLoginSource(null)
        if (!card.has_physical_card) setActiveOverlay('card-offer')
      }, 1500)

      return true
    } catch {
      setFaceAnimLoading(false)
      setTimeout(() => {
        setShowLoginAnim(false)
        setLoginSource(null)
        setCardData(null)
        toast.error('Connection timeout — please try again')
      }, 1500)
      return false
    }
  }

  async function handleNfcTap(uid: string) {
    setLoginSource('nfc')
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
          setLoginSource(null)
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

  async function handleNfcConfirm() {
    const action = pendingActionRef.current
    const uid = cardDataRef.current?.uid
    if (!action || !uid) return
    setPendingAction(null)
    const encodedUid = encodeURIComponent(uid)
    try {
      if (action.type === 'topup') {
        const res = await fetch(`${BASE_API}/api/cards/${encodedUid}/topup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: action.amount }),
        })
        const json = await res.json()
        if (json.success) {
          setBalance(json.data.points_balance)
          setPoints(json.data.points_balance)
          toast.success(`Top-up RM${action.amount} confirmed!`)
        } else {
          toast.error('Top-up failed')
        }
      } else if (action.type === 'calorie') {
        const res = await fetch(`${BASE_API}/api/cards/${encodedUid}/calorie-limit`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calorie_limit: action.limit }),
        })
        const json = await res.json()
        if (json.success) {
          setCalorieTarget(action.limit)
          toast.success(`Calorie target set to ${action.limit} kcal`)
        } else {
          toast.error('Failed to save calorie target')
        }
      } else if (action.type === 'campaign') {
        const res = await fetch(`${BASE_API}/api/campaigns/${action.campaign_id}/enrol`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ card_uid: uid }),
        })
        const json = await res.json()
        if (json.success) {
          await loadCardData(uid, encodedUid)
          toast.success(`Enrolled in "${action.name}"!`)
        } else {
          toast.error(json.message ?? 'Enrolment failed')
        }
      }
    } catch {
      toast.error('Connection error — please try again')
      setPendingAction(action)
    }
  }

  async function handleNfcLink(newUid: string) {
    const current = cardDataRef.current
    if (!current?.uid) return
    setCardLinkStatus('linking')
    try {
      const encodedOldUid = encodeURIComponent(current.uid)
      const res = await fetch(`${BASE_API}/api/cards/${encodedOldUid}/link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_uid: newUid }),
      })
      const json = await res.json()
      if (json.success) {
        setCardData((prev: any) => ({ ...prev, uid: newUid, has_physical_card: true }))
        setCardLinkStatus('done')
      } else {
        toast.error(json.message ?? 'Card linking failed')
        setCardLinkStatus('error')
      }
    } catch {
      toast.error('Failed to link card — check connection')
      setCardLinkStatus('error')
    }
  }

  function handleLogout() {
    // Remember who just logged out so the face poll doesn't instantly re-login
    // them while they're still standing in front of the camera.
    logoutInfo.current = { uid: lastFaceUid.current, at: Date.now() }
    setIsUserMode(false)
    setCardData(null)
    setBalance(0)
    setPoints(0)
    setActiveCampaigns(0)
    setCampaigns([])
    setLoginSource(null)
    setCardLinkStatus('idle')
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
    setSearchActive(false)
    setFilters({ category: null, calories: null, dietary: [], vendorType: [], distance: [], voucher: null, availability: [] })
    setActiveOverlay(null)
  }

  const handleIconClick = (action: string) => {
    setSearchActive(false)
    if (action === 'language') {
      setLanguage(prev => prev === 'en' ? 'ms' : prev === 'ms' ? 'zh' : 'en')
    } else if (action === 'nav') {
      setNavDestination(null)
      setActiveOverlay('nav')
    } else {
      setActiveOverlay(action as Overlay)
    }
  }

  const handleStallClick = (stall: Stall) => {
    setSearchActive(false)
    setActiveStall(stall)
    setActiveOverlay('stall')
  }

  const handleNavigate = () => {
    setNavDestination(activeStall)
    setActiveOverlay('nav')
  }

  return (
    <div className="w-full h-screen bg-[#FAF7F0] overflow-hidden flex flex-col relative font-sans">
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onLogoClick={handleLogoClick}
        onIconClick={handleIconClick}
        language={language}
        isUserMode={isUserMode}
        cardData={cardData ? { owner_name: cardData.owner_name, points_balance: points } : null}
        faceDaemonOnline={faceDaemonOnline}
        searchActive={searchActive}
        onSearchActivate={() => setSearchActive(true)}
        onSearchClose={() => setSearchActive(false)}
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

      {/* Main content — one scrolling column so the hero banner and category bar
          scroll away with the list, revealing the full food grid. */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <Intro
            activeCategory={filters.category as any}
            onCategoryClick={(cat) => setFilters(prev => ({ ...prev, category: prev.category === cat ? null : cat }))}
            language={language}
          />

          <StallGrid
            stalls={filteredStalls}
            filters={filters}
            setFilters={setFilters}
            onStallClick={handleStallClick}
            onOpenMenu={() => setActiveOverlay('menu')}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            language={language}
          />
        </div>

        {loadingStalls && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <p className="text-gray-500 animate-pulse">Loading stalls...</p>
          </div>
        )}
      </div>

      {/* Emergency Button — sits above the bottom nav */}
      <button
        onClick={() => setActiveOverlay('emergency')}
        className="absolute bottom-[5.5rem] left-6 w-14 h-14 bg-red-600 rounded-full shadow-lg flex items-center justify-center text-white hover:bg-red-700 transition-colors z-30"
      >
        <AlertTriangle className="w-6 h-6" />
      </button>

      {/* Backdrop */}
      {activeOverlay && activeOverlay !== 'nav' && activeOverlay !== 'emergency' && (
        <div className="absolute inset-0 bg-black/40 z-30 transition-opacity" onClick={() => setActiveOverlay(null)} />
      )}

      {/* Quick menu — bottom sheet (mobile replacement for the old left sidebar) */}
      {activeOverlay === 'menu' && (
        <div className="absolute inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto no-scrollbar rounded-t-3xl bg-[#F2ECE0] shadow-2xl anim-slide-up">
          <div className="sticky top-0 z-10 flex justify-center bg-[#F2ECE0] pt-3 pb-1">
            <div className="h-1.5 w-12 rounded-full bg-[#C9BFB2]" />
          </div>
          <FilterPanel
            language={language}
            isUserMode={isUserMode}
            onAction={handleIconClick}
            preferences={preferences}
            setPreferences={setPreferences}
          />
        </div>
      )}

      {/* NFC card offer — shown after face login when user has no physical card */}
      {activeOverlay === 'card-offer' && (
        <NfcCardOfferModal
          onClose={() => { setActiveOverlay(null); setCardLinkStatus('idle') }}
          onConfirmCollect={() => {
              // Trigger the physical card dispenser (fire-and-forget)
              const dispenserUrl = import.meta.env.VITE_DISPENSER_URL
              if (dispenserUrl) {
                fetch(`${dispenserUrl}/dispense`, { method: 'POST' }).catch(() => {})
              }
              setCardLinkStatus('linking')
            }}
          linkStatus={cardLinkStatus}
          onLinkComplete={() => { setActiveOverlay(null); setCardLinkStatus('idle') }}
          language={language}
        />
      )}

      {/* Login Animation */}
      {showLoginAnim && loginSource && (
        <LoginAnimation
          loginSource={loginSource}
          ownerName={cardData?.owner_name}
          confidence={loginSource === 'face' ? faceConfidence : undefined}
          isLoading={faceAnimLoading}
        />
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
          cardUid={cardData?.uid ?? null}
          ownerName={cardData?.owner_name}
          campaigns={campaigns}
          onRequestNfcConfirm={setPendingAction}
          onNavigateToStall={(stallName) => {
            const stall = stalls.find(s => s.name === stallName)
            if (stall) { setNavDestination(stall); setActiveOverlay('nav') }
          }}
        />
      )}

      {/* NFC action confirmation overlay */}
      {pendingAction && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="bg-[#FAF7F0] p-8 rounded-3xl w-full max-w-md text-center shadow-2xl">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 bg-[#FDF0E8] rounded-full animate-ping opacity-60" />
              <div className="relative w-20 h-20 bg-[#FDF0E8] rounded-full flex items-center justify-center">
                <Wifi className="w-10 h-10 text-[#E8622A]" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Tap your card to confirm</h2>
            <p className="text-gray-600 text-base mb-1">
              {pendingAction.type === 'topup'
                ? `Top-up RM${pendingAction.amount} via ${pendingAction.method}`
                : pendingAction.type === 'calorie'
                  ? `Set daily calorie target to ${pendingAction.limit} kcal`
                  : `Enrol in "${pendingAction.name}"`}
            </p>
            <p className="text-sm text-gray-400 mb-8">Hold your NFC card on the reader</p>
            <button
              onClick={() => setPendingAction(null)}
              className="w-full py-4 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
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
          cardUid={cardData?.uid ?? null}
          onRequestNfcConfirm={setPendingAction}
        />
      )}

      {activeOverlay === 'help' && (
        <HelpDrawer onClose={() => setActiveOverlay(null)} language={language} />
      )}

      {activeOverlay === 'nav' && (
        <SmartNav destination={navDestination} stalls={stalls} onClose={() => setActiveOverlay(null)} language={language} />
      )}

      {activeOverlay === 'emergency' && (
        <EmergencyModal onClose={() => setActiveOverlay(null)} language={language} />
      )}

      {/* Bottom navigation — hidden for full-screen modal flows and while typing */}
      {!pendingAction && !searchActive && activeOverlay !== 'nav' && activeOverlay !== 'card-offer' && activeOverlay !== 'emergency' && (
        <BottomNav activeOverlay={activeOverlay} onAction={handleIconClick} />
      )}

      {/* Floating on-screen keyboard for search (kiosk has no physical keyboard) */}
      {searchActive && (
        <>
          {/* Transparent layer: tap anywhere outside the keyboard/search to dismiss */}
          <div className="absolute inset-0 z-40" onClick={() => setSearchActive(false)} />
          <OnScreenKeyboard
            value={searchQuery}
            onChange={setSearchQuery}
            onClose={() => setSearchActive(false)}
            language={language}
          />
        </>
      )}

      <Toaster position="top-center" />
    </div>
  )
}
