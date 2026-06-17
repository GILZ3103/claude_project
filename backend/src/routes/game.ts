import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { validate } from '../middleware/validate'

const router = Router()

// Prize pool — points are display units (1 pt = 0.01 RM added to points_balance)
const PRIZES = [
  { index: 0, label: 'Try Again', points: 0,   weight: 20 },
  { index: 1, label: '+5 pts',    points: 5,   weight: 28 },
  { index: 2, label: '+10 pts',   points: 10,  weight: 22 },
  { index: 3, label: '+20 pts',   points: 20,  weight: 14 },
  { index: 4, label: '+30 pts',   points: 30,  weight: 8  },
  { index: 5, label: '+50 pts',   points: 50,  weight: 5  },
  { index: 6, label: '+100 pts',  points: 100, weight: 2  },
  { index: 7, label: '+200 pts!', points: 200, weight: 1  },
]

function pickPrize() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0)
  let rand = Math.random() * total
  for (const prize of PRIZES) {
    rand -= prize.weight
    if (rand <= 0) return prize
  }
  return PRIZES[0]
}

const spinSchema = z.object({
  card_uid: z.string().min(4).max(20),
})

// ── Skill games (Flappy Burger, Stack Tower) ──────────────────────────────
// These never modify points_balance. Score milestones grant a voucher, deduped
// per user per game via the game_reward_log UNIQUE constraint.

type GameKey = 'FLAPPY' | 'STACK'

// Score milestones -> voucher discount value (RM). Tune freely.
const MILESTONES: Record<GameKey, { score: number; reward: number }[]> = {
  FLAPPY: [
    { score: 10,  reward: 1 },
    { score: 25,  reward: 2 },
    { score: 50,  reward: 5 },
    { score: 100, reward: 10 },
  ],
  STACK: [
    { score: 10, reward: 1 },
    { score: 20, reward: 2 },
    { score: 40, reward: 5 },
    { score: 75, reward: 10 },
  ],
}

// Reject obviously impossible scores before they touch the DB.
const MAX_PLAUSIBLE: Record<GameKey, number> = { FLAPPY: 100000, STACK: 100000 }

const scoreSchema = z.object({
  card_uid: z.string().min(4).max(20),
  game: z.enum(['FLAPPY', 'STACK']),
  score: z.number().int().min(0),
})

// POST /api/game/spin
router.post('/spin', validate(spinSchema), async (req: Request, res: Response): Promise<void> => {
  const { card_uid } = req.body

  const { data: card, error } = await supabase
    .from('cards')
    .select('uid, points_balance')
    .or(`uid.eq.${card_uid},nfc_uid.eq.${card_uid}`)
    .single()

  if (error || !card) {
    res.json({ success: false, message: 'Card not found' })
    return
  }

  const prize = pickPrize()

  if (prize.points > 0) {
    await supabase
      .from('cards')
      .update({ points_balance: Number(card.points_balance) + prize.points / 100 })
      .eq('uid', card.uid)
  }

  res.json({
    success: true,
    data: { prizeIndex: prize.index, label: prize.label, points: prize.points },
  })
})

// POST /api/game/score — submit a skill-game run
router.post('/score', validate(scoreSchema), async (req: Request, res: Response): Promise<void> => {
  const { card_uid, game, score } = req.body as { card_uid: string; game: GameKey; score: number }

  if (score > MAX_PLAUSIBLE[game]) {
    res.json({ success: false, message: 'Implausible score rejected.' })
    return
  }

  const { data: card } = await supabase
    .from('cards')
    .select('uid')
    .or(`uid.eq.${card_uid},nfc_uid.eq.${card_uid}`)
    .single()

  if (!card) {
    res.json({ success: false, message: 'Card not found' })
    return
  }

  // Upsert best score for this card+game
  const { data: existing } = await supabase
    .from('game_scores')
    .select('best_score, total_plays')
    .eq('card_uid', card.uid)
    .eq('game', game)
    .single()

  const prevBest = existing?.best_score ?? 0
  const best = Math.max(prevBest, score)
  const isHighScore = score > prevBest

  if (existing) {
    await supabase
      .from('game_scores')
      .update({ best_score: best, total_plays: (existing.total_plays ?? 0) + 1, last_played_at: new Date().toISOString() })
      .eq('card_uid', card.uid)
      .eq('game', game)
  } else {
    await supabase
      .from('game_scores')
      .insert({ card_uid: card.uid, game, best_score: best, total_plays: 1 })
  }

  // Issue vouchers for any newly reached milestones. The UNIQUE(card_uid, game,
  // milestone) constraint makes a duplicate insert fail -> we skip already-claimed ones.
  const newVouchers: { milestone: number; discount_value: number }[] = []
  for (const m of MILESTONES[game]) {
    if (score < m.score) continue

    const { error: logErr } = await supabase
      .from('game_reward_log')
      .insert({ card_uid: card.uid, game, milestone: m.score })

    if (logErr) continue // already claimed (unique violation) or insert failed

    const expires = new Date()
    expires.setDate(expires.getDate() + 30)

    const { data: voucher } = await supabase
      .from('vouchers')
      .insert({
        card_uid: card.uid,
        campaign_id: null,
        discount_value: m.reward,
        applicable_vendor_ids: null,
        status: 'ACTIVE',
        expires_at: expires.toISOString(),
      })
      .select('voucher_id')
      .single()

    if (voucher) {
      await supabase
        .from('game_reward_log')
        .update({ voucher_id: voucher.voucher_id })
        .eq('card_uid', card.uid)
        .eq('game', game)
        .eq('milestone', m.score)
    }

    newVouchers.push({ milestone: m.score, discount_value: m.reward })
  }

  res.json({ success: true, data: { best, isHighScore, newVouchers } })
})

// GET /api/game/leaderboard?game=FLAPPY&limit=10
router.get('/leaderboard', async (req: Request, res: Response): Promise<void> => {
  const game = String(req.query.game ?? '').toUpperCase()
  const limit = Math.min(Number(req.query.limit ?? 10) || 10, 50)

  if (game !== 'FLAPPY' && game !== 'STACK') {
    res.status(400).json({ success: false, error: 'INVALID_GAME', message: 'game must be FLAPPY or STACK' })
    return
  }

  const { data, error } = await supabase
    .from('game_scores')
    .select('best_score, cards(owner_name)')
    .eq('game', game)
    .order('best_score', { ascending: false })
    .limit(limit)

  if (error) throw error

  const leaderboard = (data ?? []).map((row: any, i: number) => ({
    rank: i + 1,
    name: row.cards?.owner_name ?? 'Player',
    score: row.best_score,
  }))

  res.json({ success: true, data: leaderboard })
})

// GET /api/game/stats?card_uid= — this card's best score per game
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const card_uid = String(req.query.card_uid ?? '')
  if (!card_uid) {
    res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: 'card_uid is required' })
    return
  }

  const { data } = await supabase
    .from('game_scores')
    .select('game, best_score, total_plays')
    .eq('card_uid', card_uid)

  const stats: Record<string, { best_score: number; total_plays: number }> = {}
  for (const row of data ?? []) {
    stats[row.game] = { best_score: row.best_score, total_plays: row.total_plays }
  }

  res.json({ success: true, data: stats })
})

export default router
