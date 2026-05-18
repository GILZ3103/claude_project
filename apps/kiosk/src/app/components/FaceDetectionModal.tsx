import { useState } from 'react';
import { X, ArrowDownRight, CreditCard } from 'lucide-react';
import { translations } from '../translations';

interface FaceDetectionModalProps {
  onSuccess: (hasNfc: boolean) => void;
  onClose: () => void;
  language: 'en' | 'ms' | 'zh';
}

export function FaceDetectionModal({ onSuccess, onClose, language }: FaceDetectionModalProps) {
  const t = translations[language];
  const [step, setStep] = useState<'detected' | 'new-user-detected' | 'onboarding-warn' | 'onboarding-collect'>('detected');

  if (step === 'detected') {
    return (
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl w-full max-w-lg text-center relative overflow-hidden shadow-2xl">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <X className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="relative w-32 h-32 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-orange-500 rounded-full animate-[spin_3s_linear_infinite] border-t-transparent" />
            <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?crop=faces&fit=crop&w=200&h=200" alt="Face" className="w-full h-full object-cover rounded-full p-1" />
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{t.welcomeBack}, Sarah!</h2>
          
          <div className="bg-gray-50 rounded-2xl p-4 text-left mb-6 max-w-sm mx-auto border border-gray-100">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Name:</span>
                <span className="font-bold text-gray-900">Sarah Lee</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Phone:</span>
                <span className="font-bold text-gray-900">+60 12-345 6789</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Member Status:</span>
                <span className="font-bold text-orange-600">Registered User</span>
              </div>
            </div>
          </div>
          
          <p className="text-xl text-gray-800 font-bold mb-6">{t.isThatYou}</p>
          
          <div className="flex gap-4">
            <button 
              onClick={() => onClose()} 
              className="flex-1 py-4 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              {t.no}
            </button>
            <button 
              onClick={() => onSuccess(true)} 
              className="flex-1 py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30"
            >
              {t.yes}
            </button>
          </div>
          
          <div className="mt-8 border-t border-gray-100 pt-4">
            <button 
              onClick={() => setStep('new-user-detected')}
              className="text-xs text-gray-400 underline hover:text-gray-600"
            >
              {t.simulateFirstTime}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'new-user-detected') {
    return (
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl w-full max-w-lg text-center relative overflow-hidden shadow-2xl">
          <div className="relative w-32 h-32 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-green-500 rounded-full animate-[spin_3s_linear_infinite] border-t-transparent" />
            <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=faces&fit=crop&w=200&h=200" alt="Face" className="w-full h-full object-cover rounded-full p-1" />
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{t.welcomeWarungTek}</h2>
          <p className="text-gray-600 mb-8 text-lg">{t.collectNfcPrompt}</p>
          
          <div className="flex gap-4">
            <button 
              onClick={() => setStep('onboarding-warn')} 
              className="flex-1 py-4 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              {t.later}
            </button>
            <button 
              onClick={() => setStep('onboarding-collect')} 
              className="flex-1 py-4 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
            >
              {t.yes}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'onboarding-warn') {
    return (
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">{t.areYouSure}</h3>
          <p className="text-gray-600 mb-8 leading-relaxed">
            {t.missRewardsWarn}
          </p>
          <div className="flex gap-4">
            <button onClick={() => onClose()} className="flex-1 py-3 bg-gray-100 text-gray-800 font-bold rounded-xl text-sm">{t.continueAnyway}</button>
            <button onClick={() => setStep('onboarding-collect')} className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl text-sm">{t.collectCardNow}</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'onboarding-collect') {
    return (
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl w-full max-w-xl text-center relative">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">{t.nfcCardCol}</h2>
          
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-50 p-6 rounded-2xl flex flex-col items-center justify-center relative">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold absolute -top-4 -left-4">1</div>
              <p className="font-bold text-gray-900 mb-4">{t.collectHere}</p>
              <ArrowDownRight className="w-12 h-12 text-orange-500 animate-bounce" />
            </div>
            
            <div className="bg-gray-50 p-6 rounded-2xl flex flex-col items-center justify-center relative">
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold absolute -top-4 -left-4">2</div>
              <p className="font-bold text-gray-900 mb-4">{t.tapToRegister}</p>
              <div className="relative">
                <CreditCard className="w-16 h-16 text-black z-10 relative animate-pulse" />
                <div className="absolute inset-0 bg-orange-400 blur-xl opacity-50 animate-pulse rounded-full" />
              </div>
            </div>
          </div>

          <button 
            onClick={() => onSuccess(true)} 
            className="w-full py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors text-lg shadow-lg shadow-orange-500/30"
          >
            {t.tappedCardBtn}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
