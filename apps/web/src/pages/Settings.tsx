import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { User, Lock, Bluetooth, HelpCircle, ChevronDown, CreditCard, LogOut, ArrowRight, Camera, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCard } from '../context/CardContext'
import { uploadCardPhoto } from '../lib/api'
import { fileToResizedDataUrl } from '../lib/image'

const FAQS = [
  {
    q: 'What is WarungTek?',
    a: 'WarungTek is a smart night market management system. Consumers use an NFC card to pay at vendor stalls, track their calorie intake, and earn vouchers through campaigns.'
  },
  {
    q: 'How do I top up my wallet?',
    a: 'Go to the Home page and tap "Top Up". Select the amount (RM 10, 20, 50, or 100) and follow the payment instructions. Your balance updates instantly.'
  },
  {
    q: 'What is an NFC card and why do I need one?',
    a: 'An NFC card is your physical WarungTek card — tap it at a vendor\'s terminal to pay. You can register without one and collect it at the WarungTek kiosk. Once collected, link it in Settings.'
  },
  {
    q: 'How do I earn vouchers?',
    a: 'Join campaigns on the Campaigns page. Complete the challenge (e.g. visit 3 vendors, spend RM 20) to unlock a voucher automatically.'
  },
  {
    q: 'Is my calorie data accurate?',
    a: 'Calorie data comes from vendor menu items. Accuracy depends on what vendors enter — some stalls may not have all items listed yet.'
  },
  {
    q: 'How do I change my password?',
    a: 'Password change is coming in a future update. For urgent account issues, contact WarungTek support.'
  },
]

export default function Settings() {
  const { card, unlinkCard, refreshCard } = useCard()
  const navigate = useNavigate()

  // Accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const hasPhysicalCard = card && !card.uid.startsWith('USER-')

  // Bluetooth permission
  const btSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator
  const [btAllowed, setBtAllowed] = useState<boolean>(() => localStorage.getItem('bt_allowed') === 'true')

  async function handleEnableBluetooth() {
    if (!btSupported) return
    try {
      await (navigator as any).bluetooth.requestDevice({ acceptAllDevices: true })
      localStorage.setItem('bt_allowed', 'true')
      setBtAllowed(true)
      toast.success('Bluetooth enabled')
    } catch (err: any) {
      // User cancelled the chooser or denied permission
      localStorage.setItem('bt_allowed', 'false')
      setBtAllowed(false)
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        toast.error('Bluetooth permission denied')
      }
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f || !card) return
    setUploadingPhoto(true)
    try {
      const dataUrl = await fileToResizedDataUrl(f, 400, 0.85)
      await uploadCardPhoto(card.uid, dataUrl)
      await refreshCard()
      toast.success('Profile photo updated')
    } catch (err: any) {
      toast.error(err?.message ?? 'Upload failed')
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  function handleSignOut() {
    unlinkCard()
    navigate('/')
  }

  if (!card) return <div className="p-6 text-center text-gray-400">Please sign in first.</div>

  const sectionCls = 'bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden'
  const sectionHeaderCls = 'flex items-center space-x-3 px-6 pt-5 pb-3'
  const rowCls = 'flex justify-between items-center px-6 py-3.5 border-b border-gray-50 last:border-0'

  return (
    <div className="px-4 pb-28 max-w-lg mx-auto space-y-4 pt-4">

      {/* Account Settings */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={sectionCls}>
        <div className={sectionHeaderCls}>
          <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
            <User size={16} />
          </div>
          <h2 className="text-sm font-bold text-[#1A1A1A]">Account Settings</h2>
        </div>
        {/* Photo upload row */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-50">
          <label className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#FF8A00] to-[#FFD166] flex items-center justify-center text-white font-bold text-2xl shadow-sm overflow-hidden cursor-pointer group">
            {card.photo_url ? (
              <img src={card.photo_url} alt="profile" className="w-full h-full object-cover" />
            ) : (
              <span>{(card.owner_name ?? 'U')[0].toUpperCase()}</span>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingPhoto ? <Loader size={16} className="text-white animate-spin" /> : <Camera size={16} className="text-white" />}
            </div>
            <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto} onChange={handlePhotoChange} />
          </label>
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A]">Profile Photo</p>
            <p className="text-xs text-[#6B7280]">Tap to {card.photo_url ? 'change' : 'upload'}</p>
          </div>
        </div>

        {[
          { label: 'Full Name', value: card.owner_name },
          { label: 'Email', value: card.owner_email },
          { label: 'Phone', value: card.phone_number ?? '—' },
          { label: 'Role', value: card.role.charAt(0) + card.role.slice(1).toLowerCase() },
        ].map(row => (
          <div key={row.label} className={rowCls}>
            <span className="text-sm text-[#6B7280]">{row.label}</span>
            <span className="text-sm font-medium text-[#1A1A1A] text-right max-w-[55%] truncate">{row.value}</span>
          </div>
        ))}
      </motion.div>

      {/* Password & Privacy */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={sectionCls}>
        <div className={sectionHeaderCls}>
          <div className="w-8 h-8 bg-gray-100 text-gray-500 rounded-xl flex items-center justify-center">
            <Lock size={16} />
          </div>
          <h2 className="text-sm font-bold text-[#1A1A1A]">Password & Privacy</h2>
        </div>
        <div className={rowCls}>
          <span className="text-sm text-[#6B7280]">Change Password</span>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">Coming soon</span>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs text-[#6B7280] leading-relaxed">
            Your personal data (name, email, tap history) is stored securely and never shared with third parties.
            Calorie and body data entered in the app is stored locally on your device only.
          </p>
        </div>
      </motion.div>

      {/* Bluetooth / NFC Card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={sectionCls}>
        <div className={sectionHeaderCls}>
          <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
            <Bluetooth size={16} />
          </div>
          <h2 className="text-sm font-bold text-[#1A1A1A]">Bluetooth & NFC Card</h2>
        </div>

        {/* Bluetooth permission */}
        {btSupported ? (
          <div className={rowCls}>
            <div>
              <p className="text-sm text-[#1A1A1A]">Bluetooth</p>
              <p className="text-xs text-[#6B7280]">
                {btAllowed ? 'Enabled on this device' : 'Allow Bluetooth to connect your card'}
              </p>
            </div>
            <button
              onClick={handleEnableBluetooth}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                btAllowed
                  ? 'text-green-600 bg-green-50 border-green-100'
                  : 'text-blue-600 bg-blue-50 border-blue-100 hover:bg-blue-100'
              }`}
            >
              {btAllowed ? 'Enabled' : 'Enable Bluetooth'}
            </button>
          </div>
        ) : (
          <div className={rowCls}>
            <span className="text-sm text-[#6B7280]">Bluetooth</span>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200 text-right max-w-[55%]">
              Bluetooth not supported on this browser
            </span>
          </div>
        )}

        {hasPhysicalCard ? (
          <>
            <div className={rowCls}>
              <span className="text-sm text-[#6B7280]">Status</span>
              <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-100 px-2 py-1 rounded-lg">Card Linked</span>
            </div>
            <div className={rowCls}>
              <span className="text-sm text-[#6B7280]">Card UID</span>
              <div className="flex items-center space-x-2">
                <CreditCard size={14} className="text-gray-400" />
                <span className="text-sm font-mono font-medium text-[#1A1A1A]">{card.uid}</span>
              </div>
            </div>
            <div className="px-6 pb-4 pt-1">
              <button
                onClick={() => navigate('/nfc')}
                className="flex items-center gap-2 text-xs text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
              >
                <span>View NFC & tap history</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={rowCls}>
              <span className="text-sm text-[#6B7280]">Status</span>
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg">No Card Linked</span>
            </div>
            <div className="px-6 pb-5 pt-2 space-y-3">
              <p className="text-xs text-[#6B7280]">
                Collect your physical NFC card at the WarungTek kiosk, then tap it to your phone to link it automatically.
              </p>
              <button
                onClick={() => navigate('/nfc')}
                className="w-full bg-[#1A1A1A] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <Bluetooth size={15} />
                Link NFC Card
              </button>
            </div>
          </>
        )}
      </motion.div>

      {/* FAQs */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={sectionCls}>
        <div className={sectionHeaderCls}>
          <div className="w-8 h-8 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center">
            <HelpCircle size={16} />
          </div>
          <h2 className="text-sm font-bold text-[#1A1A1A]">Frequently Asked Questions</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-[#1A1A1A] pr-4">{faq.q}</span>
                <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={16} className="text-gray-400 shrink-0" />
                </motion.div>
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-4 text-xs text-[#6B7280] leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Sign Out */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={sectionCls}>
        <div className="px-6 py-4">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center space-x-2 text-red-500 hover:text-red-600 font-semibold text-sm py-2"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}
