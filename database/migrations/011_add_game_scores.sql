-- Mini-game leaderboard + milestone reward ledger.
-- Skill games (Flappy Burger, Stack Tower) keep their own scores here and never
-- touch cards.points_balance. Crossing a score milestone issues a voucher, deduped
-- per user per game so a milestone can only ever be rewarded once.

CREATE TABLE IF NOT EXISTS game_scores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_uid       VARCHAR(20) REFERENCES cards(uid) ON DELETE CASCADE,
  game           VARCHAR(20) NOT NULL CHECK (game IN ('FLAPPY','STACK')),
  best_score     INTEGER NOT NULL DEFAULT 0,
  total_plays    INTEGER NOT NULL DEFAULT 0,
  last_played_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (card_uid, game)
);

CREATE INDEX IF NOT EXISTS idx_game_scores_leaderboard ON game_scores (game, best_score DESC);

-- One row per milestone a user has ever claimed -> prevents farming the same reward.
CREATE TABLE IF NOT EXISTS game_reward_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_uid   VARCHAR(20) REFERENCES cards(uid) ON DELETE CASCADE,
  game       VARCHAR(20) NOT NULL,
  milestone  INTEGER NOT NULL,
  voucher_id UUID REFERENCES vouchers(voucher_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (card_uid, game, milestone)
);
