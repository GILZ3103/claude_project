import { Map, Wallet, Ticket, Settings, HelpCircle, Leaf, Shield } from 'lucide-react';
import { translations } from '../translations';

// Keep FilterState exported — App.tsx imports it for stall filtering state
export interface FilterState {
  category: string | null;
  calories: string | null;
  dietary: string[];
  vendorType: string[];
  distance: string[];
  voucher: string | null;
  availability: string[];
}

interface FilterPanelProps {
  language: 'en' | 'ms' | 'zh';
  isUserMode: boolean;
  onAction: (action: string) => void;
  preferences: { halal: boolean; vegetarian: boolean; lowSugar: boolean; seafoodFree: boolean };
  setPreferences: React.Dispatch<React.SetStateAction<{ vegetarian: boolean; halal: boolean; lowSugar: boolean; seafoodFree: boolean }>>;
}

export function FilterPanel({ language, onAction, preferences, setPreferences }: FilterPanelProps) {
  const t = translations[language];

  const actions = [
    { Icon: Map,        label: 'Map',            desc: 'Find & navigate stalls', action: 'nav' },
    { Icon: Wallet,     label: t.myWallet,       desc: 'Balance & top up',       action: 'nfc' },
    { Icon: Ticket,     label: t.vouchers,       desc: 'My rewards',             action: 'vouchers' },
    { Icon: Settings,   label: 'Settings',       desc: 'Preferences & account',  action: 'settings' },
    { Icon: HelpCircle, label: t.helpSupport,    desc: 'FAQ & contact',          action: 'help' },
  ];

  return (
    <div className="w-72 flex-shrink-0 border-r border-[#EDE4D4] bg-[#F2ECE0] h-full flex flex-col">
      {/* Quick Action Buttons */}
      <div className="flex-1 p-4 space-y-2 overflow-y-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
        {actions.map(({ Icon, label, desc, action }) => (
          <button
            key={action}
            onClick={() => onAction(action)}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white border border-[#EDE4D4] hover:bg-[#FDF0E8] hover:border-[#E8622A]/30 active:scale-[0.98] transition-all touch-manipulation text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-[#FDF0E8] flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-[#E8622A]" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[#1A1208] text-sm leading-tight">{label}</div>
              <div className="text-xs text-[#8C7B6B] mt-0.5 leading-tight">{desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Dietary Quick Toggles */}
      <div className="p-4 border-t border-[#EDE4D4]">
        <p className="text-[10px] font-bold text-[#8C7B6B] uppercase tracking-widest mb-3">Dietary</p>
        <div className="space-y-2">
          <ToggleRow
            icon={<Shield className="w-4 h-4" />}
            label={t.halal}
            active={preferences.halal}
            onClick={() => setPreferences(p => ({ ...p, halal: !p.halal }))}
          />
          <ToggleRow
            icon={<Leaf className="w-4 h-4" />}
            label={t.vegetarian}
            active={preferences.vegetarian}
            onClick={() => setPreferences(p => ({ ...p, vegetarian: !p.vegetarian }))}
          />
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ icon, label, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all touch-manipulation ${
        active
          ? 'bg-[#EAF4EC] border-[#4A7C59]/40 text-[#4A7C59]'
          : 'bg-white border-[#EDE4D4] text-[#8C7B6B]'
      }`}
    >
      <div className="flex items-center gap-2 font-semibold text-sm">
        {icon}
        {label}
      </div>
      <div className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${active ? 'bg-[#4A7C59]' : 'bg-[#C9BFB2]'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${active ? 'left-[18px]' : 'left-0.5'}`} />
      </div>
    </button>
  );
}
