-- Giải đấu đấu loại trực tiếp: mỗi ván là một Rankie 1v1 thật; thắng theo phiếu → vào vòng sau.
CREATE TABLE IF NOT EXISTS tournaments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  category      text,
  status        text NOT NULL DEFAULT 'active',
  current_round integer NOT NULL DEFAULT 0,
  champion_ref  jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round          integer NOT NULL,
  position       integer NOT NULL,
  a_ref          jsonb,
  b_ref          jsonb,
  rankie_post_id uuid REFERENCES posts(id) ON DELETE SET NULL,
  winner_ref     jsonb
);

CREATE INDEX IF NOT EXISTS tournament_matches_tour_idx
  ON tournament_matches (tournament_id, round, position);
