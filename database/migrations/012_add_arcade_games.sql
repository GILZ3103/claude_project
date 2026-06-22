-- Add the new arcade skill games to the allowed game-key set.
-- Ingredient Slicer (SLICER) replaces Flappy Burger in the UI; Block Hop (JUMP)
-- and Roti Road (ROAD) are new. FLAPPY is kept in the allowed set so any historical
-- game_scores / game_reward_log rows remain valid.

ALTER TABLE game_scores DROP CONSTRAINT IF EXISTS game_scores_game_check;
ALTER TABLE game_scores
  ADD CONSTRAINT game_scores_game_check
  CHECK (game IN ('FLAPPY','STACK','SLICER','JUMP','ROAD'));
