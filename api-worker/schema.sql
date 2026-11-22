-- Run once: npx wrangler d1 execute delicious-daily --remote --file=schema.sql
-- Safe to run again (IF NOT EXISTS).

-- An account exists only after someone clicks a sign-in link, so typing a
-- stranger's address into the form never creates a row for it.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- Only a SHA-256 of each token is stored, so a copy of this table can't be
-- used to sign in.
CREATE TABLE IF NOT EXISTS login_tokens (
  hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_tokens_email ON login_tokens (email, created_at);

CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saved (
  user_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, slug)
);

-- One row per person: the whole grocery list as JSON.
CREATE TABLE IF NOT EXISTS grocery (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
