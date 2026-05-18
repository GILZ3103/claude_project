import { useEffect } from 'react'
import { X, CreditCard } from 'lucide-react'
import { translations } from '../translations'

interface FaceRecognizedModalProps {
  ownerName: string
  hasPhysicalCard: boolean
  onDismiss: () => void
  language: 'en' | 'ms' | 'zh'
}

export function FaceRecognizedModal({ ownerName, hasPhysicalCard, onDismiss, language }: FaceRecognizedModalProps) {
  const t = translations[language]

  // Auto-dismiss after 15s
  useEffect(() => {
    const timer = setTimeout(onDismiss, 15000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-8">
      <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }` }} />
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 flex flex-col items-center text-center relative animate-[fadeIn_0.3s_ease-out]">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Face pulse animation */}
        <div className="relative mb-5">
          <div className="w-20 h-20 bg-orange-100 rounded-full animate-ping absolute inset-0 opacity-40" />
          <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center relative shadow-lg">
            <span className="text-3xl font-bold text-white">{ownerName.charAt(0).toUpperCase()}</span>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-1">{t.faceWelcome}</p>
        <h2 className="text-2xl font-bold text-gray-900 mb-5">{ownerName}!</h2>

        {hasPhysicalCard ? (
          <>
            <div className="w-full bg-orange-50 rounded-xl p-4 border border-orange-100 mb-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center animate-bounce">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <span className="text-orange-700 font-semibold text-sm">{t.tapCardEarn}</span>
              </div>
              <p className="text-xs text-orange-500">Hold your NFC card on the reader below</p>
            </div>
            <button onClick={onDismiss} className="text-xs text-gray-400 hover:text-gray-600 underline">
              Skip for now
            </button>
          </>
        ) : (
          <>
            <div className="w-full bg-blue-50 rounded-xl p-4 border border-blue-100 mb-4">
              <p className="text-blue-700 font-medium text-sm">{t.getCardPrompt}</p>
            </div>
            <button
              onClick={onDismiss}
              className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors"
            >
              {t.getCard}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
