import React, { useState, useEffect } from 'react';
import { X, CreditCard, Ticket, Award, CheckCircle, QrCode } from 'lucide-react';
import { translations } from '../translations';

interface Voucher {
  id: string;
  title: string;
  stall: string;
  expiry: string;
  status: 'Active' | 'Used';
  code: string;
  terms: string;
  image?: string;
}

interface WalletPanelProps {
  onClose: () => void;
  language: 'en' | 'ms' | 'zh';
  initialTab?: 'balance' | 'vouchers' | 'loyalty';
  isUserMode: boolean;
  balance: number;
  setBalance: React.Dispatch<React.SetStateAction<number>>;
  points: number;
  setPoints: React.Dispatch<React.SetStateAction<number>>;
  vouchers: Voucher[];
  setVouchers: React.Dispatch<React.SetStateAction<Voucher[]>>;
  onNavigateToStall?: (stallName: string) => void;
}

export function WalletPanel({ 
  onClose, language, initialTab = 'balance', isUserMode, 
  balance, setBalance, points, setPoints, vouchers, setVouchers, onNavigateToStall
}: WalletPanelProps) {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Sync tab when opened from header
  useEffect(() => {
    setActiveTab(initialTab);
    setSelectedVoucher(null);
  }, [initialTab]);
  
  // Topup State
  const [topupAmount, setTopupAmount] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [isTopUpSuccess, setIsTopUpSuccess] = useState(false);

  // Voucher State
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isConfirmingVoucher, setIsConfirmingVoucher] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 mins

  // Loyalty State
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  useEffect(() => {
    let timer: any;
    if (showQR && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    } else if (showQR && countdown === 0) {
      handleVoucherUsed();
    }
    return () => clearInterval(timer);
  }, [showQR, countdown]);

  const handleTopUpConfirm = () => {
    if (topupAmount && paymentMethod) {
      setBalance(prev => prev + topupAmount);
      setIsTopUpSuccess(true);
      setTopupAmount(null);
      setPaymentMethod(null);
      setTimeout(() => setIsTopUpSuccess(false), 4000);
    }
  };

  const handleUseVoucher = () => {
    setIsConfirmingVoucher(true);
  };

  const confirmUseVoucher = () => {
    setIsConfirmingVoucher(false);
    setShowQR(true);
    setCountdown(300);
  };

  const handleVoucherUsed = () => {
    if (selectedVoucher) {
      setVouchers(prev => prev.map(v => v.id === selectedVoucher.id ? { ...v, status: 'Used' } : v));
    }
    setShowQR(false);
    setSelectedVoucher(null);
  };

  const handleRedeem = (reward: {title: string, pts: number, stall: string}) => {
    if (points >= reward.pts) {
      setPoints(p => p - reward.pts);
      setRedeemSuccess(true);
      
      // Add to vouchers
      const newVoucher: Voucher = {
        id: 'v' + Date.now(),
        title: reward.title,
        stall: reward.stall,
        expiry: 'In 30 Days',
        status: 'Active',
        code: 'RWD-' + Math.floor(Math.random()*10000),
        terms: 'Redeemed using Loyalty Points.'
      };
      setVouchers(prev => [newVoucher, ...prev]);

      setTimeout(() => setRedeemSuccess(false), 3000);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isUserMode) {
    return (
      <div className="absolute inset-y-0 right-0 w-[500px] bg-[#F7F7F5] shadow-2xl flex flex-col z-40 transform transition-transform border-l border-gray-200">
        <div className="bg-black text-white p-6 flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-bold">{t.myWallet}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
            <CreditCard className="w-12 h-12 text-gray-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{t.tapToLogin}</h3>
          <p className="text-gray-500">{t.tapToViewWallet}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-y-0 right-0 w-[500px] bg-[#F7F7F5] shadow-2xl flex flex-col z-40 transform transition-transform border-l border-gray-200">
      {/* Header */}
      <div className="bg-black text-white p-6 pb-0 flex flex-col shrink-0">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{t.myWallet}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-6">
          <TabButton active={activeTab === 'balance'} onClick={() => {setActiveTab('balance'); setSelectedVoucher(null);}} icon={<CreditCard className="w-4 h-4" />}>
            {t.nfcBalance}
          </TabButton>
          <TabButton active={activeTab === 'vouchers'} onClick={() => {setActiveTab('vouchers'); setSelectedVoucher(null);}} icon={<Ticket className="w-4 h-4" />}>
            {t.vouchers}
          </TabButton>
          <TabButton active={activeTab === 'loyalty'} onClick={() => {setActiveTab('loyalty'); setSelectedVoucher(null);}} icon={<Award className="w-4 h-4" />}>
            {t.loyalty}
          </TabButton>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 relative animate-[fadeIn_0.3s_ease-out]" key={activeTab}>
        {activeTab === 'balance' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
              <p className="text-gray-500 font-medium mb-2">{t.currentBalance}</p>
              <h3 className="text-4xl font-bold text-gray-900 mb-6">RM {balance.toFixed(2)}</h3>
            </div>

            {isTopUpSuccess && (
              <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-start gap-3 animate-[pulse_2s_ease-in-out_infinite]">
                <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
                <div>
                  <h4 className="font-bold text-green-800">{t.topupSuccess}</h4>
                  <p className="text-sm text-green-700 mt-1">{t.transactionRef} WTK-{Math.floor(Math.random()*100000)}</p>
                </div>
              </div>
            )}

            {!isTopUpSuccess && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h4 className="font-bold text-gray-900 mb-3">{t.quickTopup}</h4>
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {[5, 10, 20, 50].map(amt => (
                    <button 
                      key={amt}
                      onClick={() => setTopupAmount(amt)}
                      className={`py-2 rounded-lg font-bold transition-colors border-2
                        ${topupAmount === amt ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-800 border-transparent hover:border-gray-200'}
                      `}
                    >
                      RM {amt}
                    </button>
                  ))}
                </div>
                
                <h4 className="font-bold text-gray-900 mb-3">{t.paymentMethod}</h4>
                <div className="flex flex-wrap gap-2 mb-6">
                  {['DuitNow QR', 'Touch \'n Go', 'GrabPay'].map(method => (
                    <button 
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors
                        ${paymentMethod === method ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-transparent hover:border-gray-200'}
                      `}
                    >
                      {method}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={handleTopUpConfirm}
                  disabled={!topupAmount || !paymentMethod}
                  className={`w-full py-3 rounded-xl font-bold text-white transition-colors
                    ${topupAmount && paymentMethod ? 'bg-orange-500 hover:bg-orange-600' : 'bg-gray-300 cursor-not-allowed'}
                  `}
                >
                  {t.confirm}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'vouchers' && !selectedVoucher && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">{t.activeVouchers}</h3>
            {vouchers.filter(v => v.status === 'Active').map(v => (
              <div key={v.id} onClick={() => setSelectedVoucher(v)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                  {v.image ? <img src={v.image} className="w-full h-full object-cover" /> : <Ticket className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900">{v.title}</h4>
                  <p className="text-sm text-gray-500">{v.stall}</p>
                  <p className="text-xs text-orange-600 font-medium mt-1">Expires {v.expiry}</p>
                </div>
              </div>
            ))}

            <h3 className="font-bold text-gray-900 mt-8 opacity-60">{t.usedVouchers}</h3>
            {vouchers.filter(v => v.status === 'Used').map(v => (
              <div key={v.id} className="bg-gray-100 p-4 rounded-xl border border-gray-200 flex items-center gap-4 opacity-60">
                <div className="w-14 h-14 bg-gray-200 text-gray-500 rounded-lg flex items-center justify-center shrink-0">
                  <Ticket className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 line-through">{v.title}</h4>
                  <p className="text-sm text-gray-500">{v.stall}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'vouchers' && selectedVoucher && !showQR && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="h-40 bg-orange-100 relative">
              {selectedVoucher.image ? (
                <img src={selectedVoucher.image} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center"><Ticket className="w-12 h-12 text-orange-300" /></div>
              )}
              <button onClick={() => setSelectedVoucher(null)} className="absolute top-4 left-4 p-2 bg-black/50 text-white rounded-full"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedVoucher.title}</h2>
              <p className="text-lg text-orange-600 font-medium mb-4">{selectedVoucher.stall}</p>
              
              <div className="bg-gray-50 p-4 rounded-xl mb-6">
                <p className="text-sm text-gray-500 mb-1">{t.expiresIn}:</p>
                <p className="font-bold text-gray-900">{selectedVoucher.expiry}</p>
              </div>

              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-2">{t.terms}</h4>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{selectedVoucher.terms}</p>
                <h4 className="font-bold text-gray-900 mb-2">{t.usageInst}</h4>
                <p className="text-sm text-gray-600 leading-relaxed">Present this QR code to the vendor before making payment to apply the discount.</p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => onNavigateToStall?.(selectedVoucher.stall)}
                  className="flex-1 py-4 bg-orange-100 text-orange-700 font-bold rounded-xl hover:bg-orange-200 transition-colors"
                >
                  {t.navigateStall}
                </button>
                <button 
                  onClick={handleUseVoucher}
                  className="flex-1 py-4 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
                >
                  {t.useVoucher}
                </button>
              </div>
            </div>

            {/* Confirmation Modal Inline */}
            {isConfirmingVoucher && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50 rounded-lg">
                <div className="bg-white p-6 rounded-2xl text-center w-full max-w-sm">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{t.confirmUseVoucher}</h3>
                  <p className="text-gray-500 mb-6">Cannot be undone.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setIsConfirmingVoucher(false)} className="flex-1 py-3 bg-gray-100 text-gray-800 font-bold rounded-xl">{t.cancel}</button>
                    <button onClick={confirmUseVoucher} className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl">{t.confirm}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'vouchers' && selectedVoucher && showQR && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.redeemQR}</h2>
            <p className="text-gray-500 mb-8">{t.showToVendor}</p>
            
            <div className="w-64 h-64 bg-white border-4 border-black p-4 rounded-xl flex items-center justify-center mb-6 shadow-lg">
              <QrCode className="w-full h-full text-black" />
            </div>
            
            <p className="text-2xl font-bold tracking-[0.2em] text-orange-600 mb-6">{selectedVoucher.code}</p>
            
            <div className="text-3xl font-mono font-bold text-gray-800 animate-pulse">
              {formatTime(countdown)}
            </div>
            
            <button 
              onClick={handleVoucherUsed}
              className="mt-8 text-sm text-gray-400 hover:text-gray-800 font-medium underline"
            >
              {t.done}
            </button>
          </div>
        )}

        {activeTab === 'loyalty' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
              <p className="font-medium opacity-90 mb-1">{t.warungTekPoints}</p>
              <h3 className="text-4xl font-bold mb-4">{points} <span className="text-lg font-normal">{t.pts}</span></h3>
              <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                <div className="bg-white h-full" style={{ width: `${(points % 1000) / 10}%` }} />
              </div>
              <p className="text-sm mt-2 font-medium opacity-90">{1000 - (points % 1000)} {t.ptsToNext}</p>
            </div>

            {redeemSuccess && (
              <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-3 animate-[pulse_2s_ease-in-out]">
                <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
                <h4 className="font-bold text-green-800">{t.redeemSuccess}</h4>
              </div>
            )}

            <h4 className="font-bold text-gray-900">{t.redeemableRewards}</h4>
            <div className="space-y-4">
              {[
                { title: t.rm5Voucher, pts: 500, stall: t.anyStall },
                { title: t.freeDrinkCombo, pts: 800, stall: 'Siam Drinks' },
                { title: t.rm10Voucher, pts: 1000, stall: t.anyStall }
              ].map((reward, i) => (
                <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center text-orange-500 font-bold shrink-0">
                    <Award className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900">{reward.title}</h4>
                    <p className="text-sm text-amber-600 font-bold">{reward.pts} {t.pts}</p>
                  </div>
                  <button 
                    onClick={() => handleRedeem(reward)}
                    disabled={points < reward.pts}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors
                      ${points >= reward.pts 
                        ? 'bg-black text-white hover:bg-gray-800' 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }
                    `}
                  >
                    {t.redeem}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children, icon }: { active: boolean, onClick: () => void, children: React.ReactNode, icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={`pb-4 border-b-2 font-bold flex items-center gap-2 transition-colors
        ${active ? 'border-white text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}
      `}
    >
      {icon}
      {children}
    </button>
  );
}
