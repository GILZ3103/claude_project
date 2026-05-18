import { LogOut, Flame, Trophy, Megaphone } from 'lucide-react'
import { translations } from '../translations'

interface UserBarProps {
  ownerName: string
  points: number
  caloriesRemaining: number
  activeCampaigns: number
  onLogout: () => void
  language: 'en' | 'ms' | 'zh'
}

export function UserBar({ ownerName, points, caloriesRemaining, activeCampaigns, onLogout, language }: UserBarProps) {
  const t = translations[language]

  return (
    <div className="w-full bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-2 flex items-center justify-between shadow-md animate-[fadeIn_0.4s_ease-out]">
      <div className="flex items-center gap-1">
        <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center mr-2">
          <span className="text-white text-sm font-bold">{ownerName.charAt(0).toUpperCase()}</span>
        </div>
        <span className="text-white font-semibold text-sm">{ownerName}</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5 text-white/90">
          <Trophy className="w-4 h-4 text-yellow-200" />
          <span className="text-sm font-semibold">{points} {t.pointsBalance}</span>
        </div>

        <div className="flex items-center gap-1.5 text-white/90">
          <Flame className="w-4 h-4 text-red-200" />
          <span className="text-sm font-semibold">{Math.max(0, caloriesRemaining)} {t.calsLeft}</span>
        </div>

        {activeCampaigns > 0 && (
          <div className="flex items-center gap-1.5 text-white/90">
            <Megaphone className="w-4 h-4 text-green-200" />
            <span className="text-sm font-semibold">{activeCampaigns} {t.activeCampaigns}</span>
          </div>
        )}
      </div>

      <button
        onClick={onLogout}
        className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-medium transition-colors"
      >
        <LogOut className="w-4 h-4" />
        {t.logout}
      </button>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}} />
    </div>
  )
}
