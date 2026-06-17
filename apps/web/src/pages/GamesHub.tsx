import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Dices, Layers, Trophy, ChevronRight, Crown } from 'lucide-react'
import { useCard } from '../context/CardContext'
import { getMyGameStats, getLeaderboard, type GameStats, type LeaderboardEntry, type GameKey } from '../lib/api'

interface GameDef {
  key: 'SPIN' | GameKey
  title: string
  blurb: string
  to: string
  icon: React.ReactNode
  gradient: string
}

const GAMES: GameDef[] = [
  { key: 'FLAPPY', title: 'Flappy Burger', blurb: 'Flap through the satay sticks', to: '/games/flappy', icon: <img src="/burger-mascot.png" alt="" className="w-8 h-8 object-contain" />, gradient: 'from-[#FF8A00] to-[#FFD166]' },
  { key: 'STACK',  title: 'Stack Tower',  blurb: 'Stack ingredients sky-high',  to: '/games/stack',  icon: <Layers size={26} />, gradient: 'from-[#3B82F6] to-[#6366F1]' },
  { key: 'SPIN',   title: 'Daily Spin',   blurb: 'One free spin every day',      to: '/games/spin',   icon: <Dices size={26} />, gradient: 'from-[#22C55E] to-[#86EFAC]' },
]

export default function GamesHub() {
  const { card } = useCard()
  const navigate = useNavigate()
  const [stats, setStats] = useState<GameStats>({})
  const [board, setBoard] = useState<LeaderboardEntry[]>([])
  const [boardGame, setBoardGame] = useState<GameKey>('FLAPPY')

  useEffect(() => {
    if (!card) return
    getMyGameStats(card.uid).then(setStats).catch(() => {})
  }, [card])

  useEffect(() => {
    getLeaderboard(boardGame, 5).then(setBoard).catch(() => setBoard([]))
  }, [boardGame])

  if (!card) return <div className="p-6 text-center text-gray-400">Please sign in first.</div>

  return (
    <section className="min-h-[100dvh] bg-[#FAFAFA] pb-24">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#FF8A00] to-[#FFD166] px-6 pt-8 pb-14">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-[#FAFAFA] rounded-t-[2rem]" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-white tracking-tight">Arcade</h1>
          <p className="text-white/80 text-sm">Play, beat your best, win vouchers.</p>
        </div>
      </div>

      {/* Game cards */}
      <div className="px-4 -mt-4 space-y-3">
        {GAMES.map((g, i) => {
          const best = g.key !== 'SPIN' ? stats[g.key]?.best_score : undefined
          return (
            <motion.button
              key={g.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(g.to)}
              className="w-full bg-white rounded-[1.75rem] p-4 shadow-sm border border-gray-100 flex items-center gap-4 text-left hover:shadow-md transition-shadow"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${g.gradient} text-white flex items-center justify-center shrink-0 shadow-md`}>
                {g.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#1A1A1A]">{g.title}</p>
                <p className="text-sm text-[#6B7280] truncate">{g.blurb}</p>
                {best != null && (
                  <p className="text-xs text-orange-600 font-semibold mt-0.5 flex items-center gap-1">
                    <Trophy size={11} /> Best: {best}
                  </p>
                )}
              </div>
              <ChevronRight size={20} className="text-gray-300 shrink-0" />
            </motion.button>
          )
        })}
      </div>

      {/* Leaderboard */}
      <div className="px-4 mt-6">
        <div className="bg-white rounded-[1.75rem] p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown size={18} className="text-orange-500" />
              <h2 className="font-bold text-sm text-[#1A1A1A]">Leaderboard</h2>
            </div>
            <div className="flex bg-gray-100 rounded-xl p-1">
              {(['FLAPPY', 'STACK'] as GameKey[]).map(gk => (
                <button
                  key={gk}
                  onClick={() => setBoardGame(gk)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${boardGame === gk ? 'bg-white text-[#FF8A00] shadow-sm' : 'text-gray-500'}`}
                >
                  {gk === 'FLAPPY' ? 'Flappy' : 'Stack'}
                </button>
              ))}
            </div>
          </div>

          {board.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No scores yet — be the first!</p>
          ) : (
            <div className="space-y-1.5">
              {board.map(row => (
                <div key={row.rank} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#FAFAFA]">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      row.rank === 1 ? 'bg-orange-100 text-orange-600' : row.rank === 2 ? 'bg-gray-200 text-gray-600' : row.rank === 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {row.rank}
                    </span>
                    <span className="text-sm font-medium text-[#1A1A1A] truncate">{row.name}</span>
                  </div>
                  <span className="text-sm font-bold text-[#1A1A1A] tabular-nums">{row.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
