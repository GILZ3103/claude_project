import { useState, useEffect } from 'react'
import { CheckCircle, Wifi } from 'lucide-react'
import { translations } from '../translations'
import { NfcCardGraphic } from './NfcCardGraphic'

interface NfcCardOfferModalProps {
  onClose: () => void
  onConfirmCollect: () => void
  linkStatus: 'idle' | 'linking' | 'done' | 'error'
  onLinkComplete: () => void
  language: 'en' | 'ms' | 'zh'
}

export function NfcCardOfferModal({ onClose, onConfirmCollect, linkStatus, onLinkComplete, language }: NfcCardOfferModalProps) {
  const t = translations[language]
  const [step, setStep] = useState<'offer' | 'tapping' | 'success'>('offer')

  useEffect(() => {
    if (linkStatus === 'done' && step === 'tapping') setStep('success')
  }, [linkStatus])

  if (step === 'offer') {
    return (
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl w-full max-w-md text-center shadow-2xl animate-[fadeIn_0.3s_ease-out]">
          <div className="mx-auto mb-6 w-56 max-w-full">
            <NfcCardGraphic />
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
                setStep('tapping')
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

  if (step === 'tapping') {
    return (
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl w-full max-w-md text-center shadow-2xl">
          <div className="relative mx-auto mb-6 w-56 max-w-full">
            <div className="absolute -inset-3 rounded-3xl bg-orange-200/60 animate-ping" />
            <div className="relative">
              <NfcCardGraphic />
            </div>
          </div>
          <div className="mb-4 flex items-center justify-center gap-2 text-orange-500">
            <Wifi className="w-5 h-5 rotate-90" />
            <span className="text-sm font-semibold uppercase tracking-wider">NFC</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">{t.tapCardNow}</h2>
          <p className="text-gray-500 text-base mb-8">{t.tapCardPrompt}</p>
          <button
            onClick={onClose}
            className="w-full py-4 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition-colors"
          >
            {t.noNotNow}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-3xl w-full max-w-md text-center shadow-2xl">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{t.cardActivated}</h2>
        <p className="text-gray-500 text-base mb-8">{t.cardActivatedDesc}</p>
        <button
          onClick={onLinkComplete}
          className="w-full py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30"
        >
          {t.done}
        </button>
      </div>
    </div>
  )
}
