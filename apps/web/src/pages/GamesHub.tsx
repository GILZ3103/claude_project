import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Dices, Layers, Trophy, Crown, Gamepad2, Play, Sparkles, Gift } from 'lucide-react'
import { useCard } from '../context/CardContext'
import { getMyGameStats, getLeaderboard, type GameStats, type LeaderboardEntry, type GameKey } from '../lib/api'

interface GameDef {
  key: GameKey | 'SPIN'
  title: string
  blurb: string
  to: string
  gradient: string
  pattern: string
  icon: React.ReactNode
  scored: boolean
}

const GAMES: GameDef[] = [
  {
    key: 'SLICER', title: 'Ingredient Slicer', blurb: 'Swipe to slice, dodge the chili', to: '/games/slicer',
    gradient: 'from-[#A855F7] to-[#EC4899]', scored: true,
    pattern: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 2px, transparent 2px, transparent 12px)',
    icon: <span className="text-2xl leading-none">🔪</span>,
  },
  {
    key: 'BUBBLE', title: 'Boba Pop', blurb: 'Match 3+ to pop the pearls', to: '/games/boba',
    gradient: 'from-[#3B82F6] to-[#6366F1]', scored: true,
    pattern: 'repeating-radial-gradient(circle, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 2px, transparent 2px, transparent 11px)',
    icon: <span className="text-2xl leading-none">🧋</span>,
  },
  {
    key: 'ROAD', title: 'Roti Road', blurb: 'Hop across the traffic', to: '/games/road',
    gradient: 'from-[#22C55E] to-[#10B981]', scored: true,
    pattern: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 3px, transparent 3px, transparent 16px)',
    icon: <span className="text-2xl leading-none">🐔</span>,
  },
  {
    key: 'STACK', title: 'Stack Tower', blurb: 'Stack ingredients sky-high', to: '/games/stack',
    gradient: 'from-[#0EA5E9] to-[#22D3EE]', scored: true,
    pattern: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 3px, transparent 3px, transparent 14px)',
    icon: <Layers size={24} className="text-white" />,
  },
  {
    key: 'SPIN', title: 'Daily Spin', blurb: 'One free spin every day', to: '/games/spin',
    gradient: 'from-[#FF8A00] to-[#FFD166]', scored: false,
    pattern: 'repeating-radial-gradient(circle, rgba(255,255,255,0.55) 0px, rgba(255,255,255,0.55) 2px, transparent 2px, transparent 10px)',
    icon: <Dices size={24} className="text-white" />,
  },
]

const SCORED_KEYS: GameKey[] = ['SLICER', 'BUBBLE', 'ROAD', 'STACK']

export default function GamesHub() {
  const { card } = useCard()
  const navigate = useNavigate()
  const [stats, setStats] = useState<GameStats>({})
  const [board, setBoard] = useState<LeaderboardEntry[]>([])
  const [boardGame, setBoardGame] = useState<GameKey>('SLICER')

  useEffect(() => {
    if (!card) return
    getMyGameStats(card.uid).then(setStats).catch(() => {})
  }, [card])

  useEffect(() => {
    getLeaderboard(boardGame, 8).then(setBoard).catch(() => setBoard([]))
  }, [boardGame])

  if (!card) return <div className="p-6 text-center text-gray-400">Please sign in first.</div>

  const totalPlays = Object.values(stats).reduce((s, v) => s + (v?.total_plays ?? 0), 0)
  const bestOverall = Math.max(0, ...Object.values(stats).map(v => v?.best_score ?? 0))

  const featured = GAMES[0]
  const rest = GAMES.slice(1)
  const podium = board.slice(0, 3)
  const list = board.slice(3)
  const titleOf = (k: GameKey) => GAMES.find(g => g.key === k)?.title ?? k

  return (
    <section className="min-h-[100dvh] bg-[#FAFAFA] pb-24">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#7C3AED] via-[#A855F7] to-[#EC4899] px-5 pt-8 pb-16">
        <div className="absolute -top-12 -right-10 w-52 h-52 bg-white/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.4) 0px, rgba(255,255,255,0.4) 2px, transparent 2px, transparent 14px)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-[#FAFAFA] rounded-t-[2rem]" />

        <div className="relative z-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
            <Gamepad2 size={22} className="text-white" />
            <h1 className="text-3xl font-bold text-white tracking-tight">Arcade</h1>
          </motion.div>
          <p className="text-white/85 text-sm mt-1 flex items-center gap-1.5">
            <Sparkles size={13} /> Play, beat your best, win vouchers.
          </p>

          {/* Player summary strip */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mt-4 grid grid-cols-3 gap-2"
          >
            <div className="bg-white/15 rounded-2xl px-3 py-2.5 text-center border border-white/20">
              <p className="text-white text-xl font-bold tabular-nums leading-none">{totalPlays}</p>
              <p className="text-white/75 text-[10px] mt-1 font-medium">Games played</p>
            </div>
            <div className="bg-white/15 rounded-2xl px-3 py-2.5 text-center border border-white/20">
              <p className="text-white text-xl font-bold tabular-nums leading-none">{bestOverall}</p>
              <p className="text-white/75 text-[10px] mt-1 font-medium">Best score</p>
            </div>
            <div className="bg-white/15 rounded-2xl px-3 py-2.5 text-center border border-white/20">
              <p className="text-white text-xl font-bold leading-none">{GAMES.length}</p>
              <p className="text-white/75 text-[10px] mt-1 font-medium">Games</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Featured game */}
      <div className="px-4 -mt-6 relative z-10">
        <motion.button
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate(featured.to)}
          className={`w-full rounded-[2rem] relative overflow-hidden shadow-xl bg-gradient-to-br ${featured.gradient} p-5 flex items-center gap-4 text-left`}
        >
          <div className="absolute inset-0 opacity-25 pointer-events-none" style={{ backgroundImage: featured.pattern }} />
          <div className="absolute -bottom-8 -right-6 w-32 h-32 bg-white/15 rounded-full blur-2xl pointer-events-none" />
          <span className="absolute top-3 right-3 z-10 px-2.5 py-1 bg-white/25 backdrop-blur-sm rounded-full text-[10px] font-bold text-white border border-white/30">★ FEATURED</span>

          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 rounded-3xl bg-white shadow-lg flex items-center justify-center shrink-0 relative z-10 text-4xl"
          >
            {featured.icon}
          </motion.div>

          <div className="flex-1 min-w-0 z-10">
            <p className="font-bold text-white text-xl leading-tight">{featured.title}</p>
            <p className="text-white/80 text-sm mt-0.5">{featured.blurb}</p>
            <div className="flex items-center gap-3 mt-2">
              {featured.scored && (
                <span className="inline-flex items-center gap-1 text-white/90 text-xs font-semibold">
                  <Trophy size={12} /> Best: {stats[featured.key as GameKey]?.best_score ?? 0}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 bg-white text-[#1A1A1A] font-bold text-xs px-3 py-1.5 rounded-full shadow">
                <Play size={12} className="fill-[#1A1A1A]" /> Play now
              </span>
            </div>
          </div>
        </motion.button>
      </div>

      {/* Game grid */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        {rest.map((g, i) => {
          const best = g.scored ? stats[g.key as GameKey]?.best_score : undefined
          return (
            <motion.button
              key={g.key}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
              whileHover={{ y: -4 }} whileTap={{ scale: 0.96 }}
              onClick={() => navigate(g.to)}
              className={`relative overflow-hidden rounded-[1.75rem] shadow-lg bg-gradient-to-br ${g.gradient} p-4 h-[150px] flex flex-col justify-between text-left`}
            >
              <div className="absolute inset-0 opacity-25 pointer-events-none" style={{ backgroundImage: g.pattern }} />
              <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-white/15 rounded-full blur-xl pointer-events-none" />

              <div className="flex items-start justify-between z-10">
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
                  className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center text-2xl"
                >
                  {g.icon}
                </motion.div>
                {g.scored ? (
                  best != null && best > 0 ? (
                    <span className="inline-flex items-center gap-1 bg-white/25 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full border border-white/30">
                      <Trophy size={10} /> {best}
                    </span>
                  ) : null
                ) : (
                  <span className="bg-white/25 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full border border-white/30">Free daily</span>
                )}
              </div>

              <div className="z-10">
                <p className="font-bold text-white text-sm leading-tight">{g.title}</p>
                <p className="text-white/75 text-[11px] mt-0.5 leading-tight">{g.blurb}</p>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Your stats */}
      <div className="px-4 mt-6">
        <div className="flex items-center gap-1.5 mb-3">
          <Trophy size={13} className="text-orange-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Your records</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {SCORED_KEYS.map(k => {
            const s = stats[k]
            return (
              <div key={k} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
                <p className="text-xs font-semibold text-[#1A1A1A] truncate">{titleOf(k)}</p>
                {s && s.total_plays > 0 ? (
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-bold text-[#1A1A1A] tabular-nums">{s.best_score}</span>
                    <span className="text-[10px] text-[#6B7280]">best · {s.total_plays} plays</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 mt-1.5">No runs yet — set a record!</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-4 mt-6">
        <div className="bg-white rounded-[1.75rem] p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Crown size={18} className="text-orange-500" />
            <h2 className="font-bold text-sm text-[#1A1A1A]">Leaderboard</h2>
          </div>

          {/* Game toggle */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {SCORED_KEYS.map(gk => (
              <button
                key={gk}
                onClick={() => setBoardGame(gk)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${boardGame === gk ? 'bg-[#1A1A1A] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {titleOf(gk)}
              </button>
            ))}
          </div>

          {board.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No scores yet — be the first!</p>
          ) : (
            <>
              {/* Podium */}
              {podium.length > 0 && (
                <div className="flex items-end justify-center gap-2 mb-4">
                  {[1, 0, 2].map(slot => {
                    const row = podium[slot]
                    if (!row) return <div key={slot} className="w-[30%]" />
                    const isFirst = row.rank === 1
                    const medal = row.rank === 1 ? 'from-amber-300 to-yellow-500' : row.rank === 2 ? 'from-gray-200 to-gray-400' : 'from-amber-200 to-amber-500'
                    return (
                      <div key={slot} className={`w-[30%] flex flex-col items-center ${isFirst ? '-mt-2' : 'mt-2'}`}>
                        <div className={`relative w-14 h-14 rounded-full bg-gradient-to-br ${medal} flex items-center justify-center shadow-md`}>
                          {isFirst && <Crown size={16} className="absolute -top-4 text-amber-400 fill-amber-400" />}
                          <span className="text-white font-bold text-lg">{row.rank}</span>
                        </div>
                        <p className="text-[11px] font-semibold text-[#1A1A1A] mt-1.5 truncate max-w-full text-center">{row.name}</p>
                        <p className="text-xs font-bold text-orange-600 tabular-nums">{row.score}</p>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Remaining ranks */}
              {list.length > 0 && (
                <div className="space-y-1.5">
                  {list.map(row => (
                    <div key={row.rank} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#FAFAFA]">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 bg-gray-100 text-gray-400">{row.rank}</span>
                        <span className="text-sm font-medium text-[#1A1A1A] truncate">{row.name}</span>
                      </div>
                      <span className="text-sm font-bold text-[#1A1A1A] tabular-nums">{row.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <p className="text-[10px] text-gray-400 text-center mt-4 flex items-center justify-center gap-1">
            <Gift size={11} /> Hit score milestones to earn vouchers
          </p>
        </div>
      </div>
    </section>
  )
}
