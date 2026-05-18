import { useState } from 'react';
import { X, Phone, Mail, HelpCircle, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { translations } from '../translations';

interface HelpDrawerProps {
  onClose: () => void;
  language: 'en' | 'ms' | 'zh';
}

export function HelpDrawer({ onClose, language }: HelpDrawerProps) {
  const t = translations[language];
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: 'How to top up NFC card?', a: 'Tap your card on the kiosk scanner, select the amount, and use any supported e-wallet to complete the payment.' },
    { q: 'How to claim vouchers?', a: 'Click on the Ticket icon to view your available vouchers, then click "Use" to redeem them at participating stalls.' },
    { q: 'How to navigate stalls?', a: 'Select any stall from the grid, and click "Navigate to Stall". Follow the on-screen walking directions.' },
    { q: 'How to check balance?', a: 'Click the Wallet icon on the top right to view your current NFC card balance and recent transactions.' },
    { q: 'How to redeem loyalty rewards?', a: 'Open your Wallet, navigate to the Loyalty tab, and select a reward to redeem using your earned points.' }
  ];

  return (
    <div className="absolute inset-y-0 right-0 w-[400px] bg-white shadow-2xl flex flex-col z-40 transform transition-transform border-l border-gray-200">
      <div className="p-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-gray-700" />
          <h2 className="text-xl font-bold text-gray-900">{t.helpSupport}</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <h3 className="font-bold text-gray-900 mb-4 uppercase text-sm tracking-wider">{t.faq}</h3>
        <div className="space-y-3 mb-8">
          {faqs.map((faq, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <button 
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex justify-between items-center p-4 text-left font-bold text-gray-800 hover:bg-gray-50"
              >
                <span>{faq.q}</span>
                {openFaq === idx ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>
              {openFaq === idx && (
                <div className="p-4 pt-0 text-gray-600 text-sm">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>

        <h3 className="font-bold text-gray-900 mb-4 uppercase text-sm tracking-wider">{t.contactSupport}</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <Phone className="w-5 h-5 text-gray-600" />
            <div>
              <p className="font-bold text-gray-900">+60 3-1234 5678</p>
              <p className="text-xs text-gray-500">{t.supportHours}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <Mail className="w-5 h-5 text-gray-600" />
            <div>
              <p className="font-bold text-gray-900">support@warungtek.com</p>
              <p className="text-xs text-gray-500">{t.expectReplies}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmergencyModal({ onClose, language }: { onClose: () => void, language: 'en' | 'ms' | 'zh' }) {
  const t = translations[language];
  const [step, setStep] = useState(1);
  const [isCalling, setIsCalling] = useState(false);

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
      <div className={`bg-white rounded-2xl w-full max-w-md p-8 flex flex-col items-center text-center shadow-2xl relative overflow-hidden
        ${!isCalling && 'animate-[pulse_2s_infinite] border-4 border-red-500'}
      `}>
        {step === 1 && !isCalling && (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-8">{t.emergencyHelp}</h2>
            
            <div className="flex gap-4 w-full">
              <button 
                onClick={onClose}
                className="flex-1 py-4 bg-gray-200 text-gray-800 font-bold rounded-xl hover:bg-gray-300 transition-colors"
              >
                {t.emergencyNo}
              </button>
              <button 
                onClick={() => setStep(2)}
                className="flex-1 py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30"
              >
                {t.emergencyYes}
              </button>
            </div>
          </>
        )}

        {step === 2 && !isCalling && (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <Phone className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8">{t.callPic}</h2>
            
            <div className="flex gap-4 w-full">
              <button 
                onClick={onClose}
                className="flex-1 py-4 bg-gray-200 text-gray-800 font-bold rounded-xl hover:bg-gray-300 transition-colors"
              >
                {t.cancel}
              </button>
              <button 
                onClick={() => setIsCalling(true)}
                className="flex-1 py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30"
              >
                {t.btnCallPic}
              </button>
            </div>
          </>
        )}

        {isCalling && (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <Phone className="w-10 h-10 text-green-600 animate-bounce" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.connecting}</h2>
            <p className="text-gray-500 mb-8">{t.emergencyContact}</p>
            <button 
              onClick={onClose}
              className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
            >
              {t.endCall}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
