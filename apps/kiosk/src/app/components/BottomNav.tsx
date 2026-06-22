import { Map, Wallet, Ticket, HelpCircle, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface BottomNavProps {
  activeOverlay: string | null;
  onAction: (action: string) => void;
}

const NAV_ITEMS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: 'nav',      label: 'Map',      Icon: Map },
  { id: 'nfc',      label: 'Wallet',   Icon: Wallet },
  { id: 'vouchers', label: 'Vouchers', Icon: Ticket },
  { id: 'help',     label: 'Help',     Icon: HelpCircle },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export function BottomNav({ activeOverlay, onAction }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
      <div className="flex items-stretch px-2 py-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeOverlay === id;
          return (
            <button
              key={id}
              onClick={() => onAction(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl transition-all ${
                isActive ? 'text-[#E8622A]' : 'text-[#9CA3AF] hover:text-[#E8622A]'
              }`}
            >
              <span className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                isActive ? 'bg-[#FDF0E8]' : ''
              }`}>
                <Icon size={22} />
              </span>
              <span className="text-[11px] font-semibold leading-tight tracking-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
