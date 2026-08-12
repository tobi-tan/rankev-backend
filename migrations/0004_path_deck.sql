-- Path (branching decision tree) + Deck (Survey/Exam) content types,
-- plus participation tracking shared across Path & Deck.

-- ---- Path ----
CREATE TABLE path_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL DEFAULT 0,
  text            TEXT,
  scene_image_url TEXT,
  is_entry        BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX path_questions_post_idx ON path_questions (post_id, position);

CREATE TABLE path_answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES path_questions(id) ON DELETE CASCADE,
  label       TEXT,
  emoji       TEXT,
  image_url   TEXT,
  hotspot_x   NUMERIC(5,2),
  hotspot_y   NUMERIC(5,2),
  target_type TEXT CHECK (target_type IN ('question','ending')),
  target_id   TEXT,
  position    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX path_answers_question_idx ON path_answers (question_id, position);

CREATE TABLE path_endings (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  emoji     TEXT,
  image_url TEXT,
  count     INTEGER NOT NULL DEFAULT 0,
  comment   TEXT,
  UNIQUE (post_id, name)
);

-- ---- Deck (Survey / Exam) ----
CREATE TABLE deck_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  text        TEXT,
  voting_type TEXT CHECK (voting_type IN ('single','multiple','rating','text')),
  points      NUMERIC(4,1) NOT NULL DEFAULT 0,
  image_url   TEXT
);
CREATE INDEX deck_questions_post_idx ON deck_questions (post_id, position);

CREATE TABLE deck_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES deck_questions(id) ON DELETE CASCADE,
  label       TEXT,
  emoji       TEXT,
  image_url   TEXT,
  correct     BOOLEAN NOT NULL DEFAULT false,
  position    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX deck_options_question_idx ON deck_options (question_id, position);

-- ---- Participation (Path + Deck) ----
CREATE TABLE participations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  deck_mode       TEXT,
  ending_name     TEXT,
  score           NUMERIC(4,1),
  correct_count   INTEGER,
  total_gradable  INTEGER,
  answers         JSONB,
  detail          TEXT,
  participated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);
CREATE INDEX participations_post_idx ON participations (post_id);

CREATE TABLE path_unlocks (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  ending_name TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id, ending_name)
);
