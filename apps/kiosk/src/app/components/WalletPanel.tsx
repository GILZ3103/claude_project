import React, { useState, useEffect } from 'react';
import { X, CreditCard, Ticket, Award, CheckCircle, QrCode } from 'lucide-react';
import { translations } from '../translations';
import { NfcCardGraphic } from './NfcCardGraphic';
import { ImageWithFallback } from './ImageWithFallback';

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

interface Campaign {
  campaign_id: string;
  name: string;
  description: string;
  condition_type: string;
  condition_threshold: number;
  reward_value: number;
  progress?: { current_value: number; completed: boolean } | null;
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
  cardUid: string | null;
  ownerName?: string;
  campaigns?: Campaign[];
  onRequestNfcConfirm: (action: { type: 'topup'; amount: number; method: string } | { type: 'calorie'; limit: number } | { type: 'campaign'; campaign_id: string; name: string }) => void;
  onNavigateToStall?: (stallName: string) => void;
}

export function WalletPanel({
  onClose, language, initialTab = 'balance', isUserMode,
  balance, setBalance: _setBalance, points, setPoints, vouchers, setVouchers, cardUid: _cardUid, ownerName, campaigns = [], onRequestNfcConfirm, onNavigateToStall
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
    if (!topupAmount || !paymentMethod) return;
    onRequestNfcConfirm({ type: 'topup', amount: topupAmount, method: paymentMethod });
    setTopupAmount(null);
    setPaymentMethod(null);
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
      <div className="absolute inset-y-0 right-0 w-full max-w-[500px] bg-[#FAF7F0] shadow-2xl flex flex-col z-40 anim-slide-right border-l border-[#EDE4D4]">
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
    <div className="absolute inset-y-0 right-0 w-full max-w-[500px] bg-[#FAF7F0] shadow-2xl flex flex-col z-40 anim-slide-right border-l border-[#EDE4D4]">
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
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 relative animate-[fadeIn_0.3s_ease-out]" key={activeTab}>
        {activeTab === 'balance' && (
          <div className="space-y-6">
            <div>
              <p className="text-gray-500 font-medium mb-2 text-center">{t.currentBalance}</p>
              <NfcCardGraphic name={ownerName} balance={balance} className="max-w-sm mx-auto" />
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#EDE4D4]">
                <h4 className="font-bold text-gray-900 mb-3">{t.quickTopup}</h4>
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {[5, 10, 20, 50].map(amt => (
                    <button 
                      key={amt}
                      onClick={() => setTopupAmount(amt)}
                      className={`py-2 rounded-lg font-bold transition-colors border-2
                        ${topupAmount === amt ? 'bg-[#E8622A] text-white border-[#E8622A]' : 'bg-[#F2ECE0] text-[#1A1208] border-transparent hover:border-[#EDE4D4]'}
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
                        ${paymentMethod === method ? 'bg-[#E8622A] text-white border-[#E8622A]' : 'bg-[#F2ECE0] text-[#8C7B6B] border-transparent hover:border-[#EDE4D4]'}
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
                    ${topupAmount && paymentMethod ? 'bg-[#E8622A] hover:bg-[#E8622A]/90' : 'bg-gray-300 cursor-not-allowed'}
                  `}
                >
                  {t.confirm}
                </button>
              </div>
          </div>
        )}

        {activeTab === 'vouchers' && !selectedVoucher && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">{t.activeVouchers}</h3>
            {vouchers.filter(v => v.status === 'Active').map(v => (
              <div key={v.id} onClick={() => setSelectedVoucher(v)} className="bg-white p-4 rounded-xl shadow-sm border border-[#EDE4D4] flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-[#FDF0E8] text-[#E8622A] rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                  {v.image ? <ImageWithFallback src={v.image} className="w-full h-full object-cover" /> : <Ticket className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900">{v.title}</h4>
                  <p className="text-sm text-gray-500">{v.stall}</p>
                  <p className="text-xs text-[#E8622A] font-medium mt-1">Expires {v.expiry}</p>
                </div>
              </div>
            ))}

            <h3 className="font-bold text-gray-900 mt-8 opacity-60">{t.usedVouchers}</h3>
            {vouchers.filter(v => v.status === 'Used').map(v => (
              <div key={v.id} className="bg-[#F2ECE0] p-4 rounded-xl border border-[#EDE4D4] flex items-center gap-4 opacity-60">
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
          <div className="bg-white rounded-2xl shadow-sm border border-[#EDE4D4] overflow-hidden">
            <div className="h-40 bg-orange-100 relative">
              {selectedVoucher.image ? (
                <ImageWithFallback src={selectedVoucher.image} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center"><Ticket className="w-12 h-12 text-orange-300" /></div>
              )}
              <button onClick={() => setSelectedVoucher(null)} className="absolute top-4 left-4 p-2 bg-black/50 text-white rounded-full"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedVoucher.title}</h2>
              <p className="text-lg text-orange-600 font-medium mb-4">{selectedVoucher.stall}</p>
              
              <div className="bg-[#F2ECE0] p-4 rounded-xl mb-6">
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
                  className="flex-1 py-4 bg-[#FDF0E8] text-[#E8622A] font-bold rounded-xl hover:bg-[#FDF0E8]/80 transition-colors"
                >
                  {t.navigateStall}
                </button>
                <button 
                  onClick={handleUseVoucher}
                  className="flex-1 py-4 bg-[#E8622A] text-white font-bold rounded-xl hover:bg-[#E8622A]/90 transition-colors"
                >
                  {t.useVoucher}
                </button>
              </div>
            </div>

            {/* Confirmation Modal Inline */}
            {isConfirmingVoucher && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 z-50 rounded-lg">
                <div className="bg-white p-6 rounded-2xl text-center w-full max-w-sm">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{t.confirmUseVoucher}</h3>
                  <p className="text-gray-500 mb-6">Cannot be undone.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setIsConfirmingVoucher(false)} className="flex-1 py-3 bg-gray-100 text-gray-800 font-bold rounded-xl">{t.cancel}</button>
                    <button onClick={confirmUseVoucher} className="flex-1 py-3 bg-[#E8622A] text-white font-bold rounded-xl">{t.confirm}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'vouchers' && selectedVoucher && showQR && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#EDE4D4] p-8 flex flex-col items-center text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.redeemQR}</h2>
            <p className="text-gray-500 mb-8">{t.showToVendor}</p>
            
            <div className="w-64 h-64 bg-white border-4 border-black p-4 rounded-xl flex items-center justify-center mb-6 shadow-lg">
              <QrCode className="w-full h-full text-black" />
            </div>
            
            <p className="text-2xl font-bold tracking-[0.2em] text-[#E8622A] mb-6">{selectedVoucher.code}</p>
            
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
                <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-[#EDE4D4] flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#FDF0E8] rounded-lg flex items-center justify-center text-[#E8622A] font-bold shrink-0">
                    <Award className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900">{reward.title}</h4>
                    <p className="text-sm text-[#E8622A] font-bold">{reward.pts} {t.pts}</p>
                  </div>
                  <button
                    onClick={() => handleRedeem(reward)}
                    disabled={points < reward.pts}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors
                      ${points >= reward.pts
                        ? 'bg-[#E8622A] text-white hover:bg-[#E8622A]/90'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }
                    `}
                  >
                    {t.redeem}
                  </button>
                </div>
              ))}
            </div>

            {/* Active Campaigns */}
            {campaigns.filter(c => c.progress != null).length > 0 && (
              <>
                <h4 className="font-bold text-gray-900">My Campaigns</h4>
                <div className="space-y-3">
                  {campaigns.filter(c => c.progress != null).map(c => {
                    const pct = Math.min(100, Math.round((c.progress!.current_value / c.condition_threshold) * 100))
                    const condLabel = c.condition_type === 'VISIT_STALLS'
                      ? `${c.progress!.current_value} / ${c.condition_threshold} stalls visited`
                      : `${c.progress!.current_value} / ${c.condition_threshold} pts spent`
                    return (
                      <div key={c.campaign_id} className="bg-white p-4 rounded-xl shadow-sm border border-[#EDE4D4]">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 pr-2">
                            <h4 className="font-bold text-gray-900 text-sm">{c.name}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">Earn RM{c.reward_value} reward on completion</p>
                          </div>
                          {c.progress!.completed && (
                            <span className="text-xs font-bold text-[#4A7C59] bg-[#EAF4EC] px-2 py-1 rounded-full shrink-0">Done!</span>
                          )}
                        </div>
                        <div className="w-full bg-[#EDE4D4] h-2 rounded-full overflow-hidden mb-1">
                          <div className="bg-[#E8622A] h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-gray-500">{condLabel}</p>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Available Campaigns */}
            {campaigns.filter(c => c.progress == null).length > 0 && (
              <>
                <h4 className="font-bold text-gray-900">Available Campaigns</h4>
                <div className="space-y-3">
                  {campaigns.filter(c => c.progress == null).map(c => {
                    const condLabel = c.condition_type === 'VISIT_STALLS'
                      ? `Visit ${c.condition_threshold} stalls`
                      : c.condition_type === 'SPEND_POINTS'
                        ? `Spend ${c.condition_threshold} pts`
                        : 'Tap at kiosk'
                    return (
                      <div key={c.campaign_id} className="bg-white p-4 rounded-xl shadow-sm border border-[#EDE4D4] flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#FDF0E8] rounded-lg flex items-center justify-center shrink-0">
                          <Award className="w-5 h-5 text-[#E8622A]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 text-sm">{c.name}</h4>
                          <p className="text-xs text-gray-500">{condLabel} → RM{c.reward_value} reward</p>
                        </div>
                        <button
                          onClick={() => onRequestNfcConfirm({ type: 'campaign', campaign_id: c.campaign_id, name: c.name })}
                          className="px-4 py-2 text-sm font-bold bg-[#E8622A] text-white rounded-lg hover:bg-[#E8622A]/90 transition-colors shrink-0"
                        >
                          Enroll
                        </button>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
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
