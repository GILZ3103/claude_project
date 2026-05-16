import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Bluetooth, Camera, CheckCircle, Shield, Store, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCard } from '../context/CardContext'
import { registerCard, loginConsumer, loginVendor, loginAdmin, registerVendor } from '../lib/api'

type Role = 'consumer' | 'vendor' | 'admin'
type Mode = 'login' | 'signup'

export default function AuthPage() {
  const navigate = useNavigate()
  const { setSessionFromLogin } = useCard()

  const [mode, setMode] = useState<Mode>('login')
  const [role, setRole] = useState<Role>('consumer')
  const [submitting, setSubmitting] = useState(false)
  const [showBtPopup, setShowBtPopup] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Common fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')

  // Signup-only fields
  const [cardUid, setCardUid] = useState('')  // set after registration for the success screen
  const [phone, setPhone] = useState('')

  // Vendor-only signup
  const [businessName, setBusinessName] = useState('')
  const [ssm, setSsm] = useState('')

  // Admin-only fields
  const [authorityId, setAuthorityId] = useState('')
  const [department, setDepartment] = useState('Majlis Perbandaran')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      let result
      if (role === 'consumer') result = await loginConsumer(email, password) as any
      else if (role === 'vendor') result = await loginVendor(email, password) as any
      else result = await loginAdmin(authorityId, email, password) as any

      setSessionFromLogin(result)
      toast.success('Welcome back')

      if (role === 'admin') navigate('/admin')
      else if (role === 'vendor') navigate('/vendor/dashboard')
      else navigate('/dashboard')
    } catch (err: any) {
      toast.error(err?.message ?? 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setSubmitting(true)
    try {
      const baseBody: any = {
        owner_name: fullName,
        owner_email: email,
        password,
        role: role.toUpperCase(),
      }
      if (phone) baseBody.phone_number = phone
      if (role === 'admin') {
        baseBody.authority_id = authorityId
        baseBody.department = department
      }

      const registered = await registerCard(baseBody) as any
      const newUid = registered.uid  // backend auto-generates if not provided
      setCardUid(newUid) // store for the success screen

      // If vendor, follow up with vendor registration (creates PENDING_REVIEW vendor record)
      if (role === 'vendor') {
        await registerVendor({
          owner_card_uid: newUid,
          business_name: businessName,
          ssm_registration_number: ssm,
          phone_number: phone,
        })
      }

      // Auto-login after registration
      if (role === 'consumer') {
        const session = await loginConsumer(email, password) as any
        setSessionFromLogin(session)
        setShowBtPopup(true)
        return
      }
      if (role === 'vendor') {
        const session = await loginVendor(email, password) as any
        setSessionFromLogin(session)
        toast.success('Application submitted — pending admin review')
        navigate('/vendor/dashboard')
      }
      if (role === 'admin') {
        const session = await loginAdmin(authorityId, email, password) as any
        setSessionFromLogin(session)
        navigate('/admin')
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  function handleBtResponse(_allowed: boolean) {
    // Bluetooth integration is Phase 8 — for now we just acknowledge the choice
    setShowBtPopup(false)
    setShowSuccess(true)
  }

  function handleSuccessContinue() {
    setShowSuccess(false)
    navigate('/dashboard')
  }

  const inputCls = 'w-full bg-[#FAFAFA] border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#FF8A00] focus:ring-4 focus:ring-orange-100 transition-all text-sm'
  const labelCls = 'block text-xs font-medium text-[#6B7280] uppercase tracking-[0.02em] mb-1.5'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] p-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-[-10%] -left-[10%] w-[50vw] h-[50vw] bg-[#FF8A00] rounded-full mix-blend-multiply filter blur-[100px] opacity-[0.12]" />
      <div className="absolute top-[20%] -right-[10%] w-[40vw] h-[40vw] bg-[#3B82F6] rounded-full mix-blend-multiply filter blur-[120px] opacity-[0.12]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md bg-white rounded-[2rem] p-8 shadow-2xl border border-gray-100 z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-[#FF8A00] to-[#FFAE4D] rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-xl">W</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">WarungTek</h2>
          <p className="text-sm text-[#6B7280] font-medium mt-1">Smart Night Market System</p>
        </div>

        {/* Role toggle */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl mb-6 shadow-inner border border-gray-200">
          {(['consumer', 'vendor', 'admin'] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 flex items-center justify-center py-2 text-xs font-semibold rounded-lg transition-all ${role === r ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {r === 'consumer' && <User size={14} className="mr-1.5" />}
              {r === 'vendor' && <Store size={14} className="mr-1.5" />}
              {r === 'admin' && <Shield size={14} className="mr-1.5" />}
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        {/* Login/signup toggle (admin = login only) */}
        {role !== 'admin' && (
          <div className="flex border-b border-gray-200 mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all ${mode === 'login' ? 'border-[#FF8A00] text-[#FF8A00]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >Log In</button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all ${mode === 'signup' ? 'border-[#FF8A00] text-[#FF8A00]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >Sign Up</button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {(mode === 'login' || role === 'admin') ? (
            <motion.form
              key={`login-${role}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleLogin}
              className="space-y-4"
            >
              {role === 'admin' && (
                <div className="bg-blue-50 text-blue-800 text-xs font-bold px-4 py-3 rounded-xl border border-blue-200 mb-6 flex items-start">
                  <Shield size={16} className="mr-2 shrink-0 mt-0.5" />
                  Restricted to authorized enforcement and management personnel only.
                </div>
              )}

              {role === 'admin' && (
                <div>
                  <label className={labelCls}>Authority ID</label>
                  <input type="text" required value={authorityId} onChange={e => setAuthorityId(e.target.value)} className={inputCls} />
                </div>
              )}

              {role === 'admin' && (
                <div>
                  <label className={labelCls}>Department</label>
                  <select value={department} onChange={e => setDepartment(e.target.value)} className={inputCls}>
                    <option>Majlis Perbandaran</option>
                    <option>Local Council</option>
                    <option>Enforcement Department</option>
                    <option>Health Inspection Department</option>
                  </select>
                </div>
              )}

              <div>
                <label className={labelCls}>{role === 'admin' ? 'Official Email' : 'Email'}</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Password</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#1A1A1A] hover:bg-gray-800 text-white font-semibold py-3.5 rounded-xl shadow-md transition-all mt-6 disabled:opacity-50"
              >
                {submitting ? 'Signing in…' : 'Log In'}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key={`signup-${role}`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleSignup}
              className="space-y-4"
            >
              <div>
                <label className={labelCls}>Full Name</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Phone Number</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="0123456789" />
              </div>

              {role === 'vendor' && (
                <>
                  <div>
                    <label className={labelCls}>Business Name</label>
                    <input type="text" required value={businessName} onChange={e => setBusinessName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>SSM Registration Number</label>
                    <input type="text" required value={ssm} onChange={e => setSsm(e.target.value)} className={inputCls} placeholder="001234567-A" />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Password</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Confirm</label>
                  <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="pt-2">
                <label className={labelCls}>Identity Photo (optional)</label>
                <div className="w-full h-24 bg-[#FAFAFA] border-2 border-dashed border-gray-300 hover:border-gray-400 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors group">
                  <Camera className="text-gray-400 group-hover:text-gray-600 mb-1" size={20} />
                  <span className="text-xs font-semibold text-gray-500 group-hover:text-gray-700">Upload coming soon</span>
                </div>
              </div>

              {role === 'consumer' && (
                <div className="bg-blue-50 text-blue-800 text-xs font-medium px-3 py-2 rounded-lg border border-blue-200">
                  📇 You'll collect your physical NFC card at the WarungTek kiosk and link it to your account afterwards.
                </div>
              )}

              {role === 'vendor' && (
                <div className="bg-amber-50 text-amber-800 text-xs font-medium px-3 py-2 rounded-lg border border-amber-200">
                  Your vendor application will be pending admin review after signup.
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#1A1A1A] hover:bg-gray-800 text-white font-semibold py-3.5 rounded-xl shadow-md transition-all mt-6 disabled:opacity-50"
              >
                {submitting ? 'Creating account…' : 'Sign Up'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Bluetooth permission popup */}
      <AnimatePresence>
        {showBtPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#1A1A1A]/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-100">
                <Bluetooth size={32} />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#1A1A1A] mb-3">Bluetooth Access</h3>
              <p className="text-sm text-[#6B7280] mb-8">Allow Bluetooth to enable indoor navigation and stall tracking. (Feature coming soon)</p>
              <div className="flex space-x-3">
                <button onClick={() => handleBtResponse(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-[#1A1A1A] font-semibold py-3.5 rounded-xl transition-colors">Later</button>
                <button onClick={() => handleBtResponse(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl shadow-md transition-colors">Allow</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success popup */}
      <AnimatePresence>
        {showSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#1A1A1A]/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl text-center">
              <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-green-100">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#1A1A1A] mb-3">Registration Successful</h3>
              <p className="text-sm text-[#6B7280] mb-6">Please collect your personal NFC card at the WarungTek kiosk.</p>

              <div className="w-full h-32 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-4 flex flex-col justify-between mb-8 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl transform translate-x-1/2 -translate-y-1/2" />
                <div className="flex justify-between items-center text-white/50">
                  <span className="font-bold text-xs tracking-wider">WarungTek</span>
                  <Bluetooth size={14} />
                </div>
                <div className="text-white font-mono tracking-widest text-sm opacity-80 mt-auto">
                  **** **** **** {cardUid.slice(-4) || '0000'}
                </div>
              </div>

              <button onClick={handleSuccessContinue} className="w-full bg-[#1A1A1A] hover:bg-gray-800 text-white font-semibold py-3.5 rounded-xl shadow-md transition-colors">Continue</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
