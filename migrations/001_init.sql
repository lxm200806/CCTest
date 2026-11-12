CREATE TABLE users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  credits integer NOT NULL CHECK (credits >= 0),
  created_at timestamptz NOT NULL
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE students (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES users (id),
  name text NOT NULL,
  grade_band text NOT NULL,
  grade text NOT NULL,
  school text NOT NULL,
  guardian text NOT NULL,
  goal text NOT NULL,
  weekly_minutes integer NOT NULL,
  focus text NOT NULL,
  subjects jsonb NOT NULL
);

CREATE TABLE checkins (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id),
  day date NOT NULL,
  step integer NOT NULL CHECK (step BETWEEN 1 AND 6),
  done boolean NOT NULL,
  UNIQUE (user_id, day, step)
);

CREATE TABLE generations (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id),
  tool_id text NOT NULL,
  tool_name text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL,
  input jsonb NOT NULL,
  result jsonb NOT NULL
);

CREATE TABLE ledger (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id),
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  note text NOT NULL,
  tool_id text,
  generation_id text,
  created_at timestamptz NOT NULL
);

CREATE TABLE generation_requests (
  user_id text NOT NULL REFERENCES users (id),
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('reserved', 'completed', 'refunded')),
  cost integer NOT NULL CHECK (cost > 0),
  tool_id text NOT NULL,
  generation_id text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, idempotency_key)
);

CREATE TABLE rate_limits (
  bucket text PRIMARY KEY,
  count integer NOT NULL,
  window_start timestamptz NOT NULL
);
