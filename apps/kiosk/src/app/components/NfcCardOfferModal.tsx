import { useState } from 'react'
import { CreditCard, ArrowDownRight } from 'lucide-react'
import { translations } from '../translations'

interface NfcCardOfferModalProps {
  onClose: () => void
  onConfirmCollect: () => void
  language: 'en' | 'ms' | 'zh'
}

export function NfcCardOfferModal({ onClose, onConfirmCollect, language }: NfcCardOfferModalProps) {
  const t = translations[language]
  const [step, setStep] = useState<'offer' | 'collecting'>('offer')

  if (step === 'offer') {
    return (
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl w-full max-w-md text-center shadow-2xl animate-[fadeIn_0.3s_ease-out]">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CreditCard className="w-10 h-10 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">{t.noCardYet}</h2>
          <p className="text-gray-600 mb-8 text-lg">{t.collectCardPrompt}</p>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              {t.noNotNow}
            </button>
            <button
              onClick={() => {
                setStep('collecting')
                onConfirmCollect()
              }}
              className="flex-1 py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30"
            >
              {t.yesCollectNow}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-3xl w-full max-w-md text-center shadow-2xl">
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ArrowDownRight className="w-10 h-10 text-orange-500 animate-bounce" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{t.collectFromSlot}</h2>
        <p className="text-gray-400 text-sm mb-8">{t.dispenserSoon}</p>
        <button
          onClick={onClose}
          className="w-full py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors"
        >
          {t.done}
        </button>
      </div>
    </div>
  )
}
